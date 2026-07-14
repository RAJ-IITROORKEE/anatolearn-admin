import { describe, expect, it, vi } from "vitest";

import {
  BootstrapError,
  bootstrapAdmin,
  runBootstrapAdminCli,
  type AuthAdminPort,
  type ProfileStore,
} from "./bootstrap-admin-service";

const existingUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  user_metadata: { full_name: "Existing Admin" },
};

function createAuth(overrides: Partial<AuthAdminPort> = {}): AuthAdminPort {
  return {
    listUsers: vi.fn().mockResolvedValue({ users: [existingUser] }),
    createUser: vi.fn().mockResolvedValue({ user: existingUser }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createProfiles(): ProfileStore {
  return { upsertAdmin: vi.fn().mockResolvedValue(undefined) };
}

describe("bootstrapAdmin", () => {
  it("links an existing auth user without requiring or changing a password", async () => {
    const auth = createAuth();
    const profiles = createProfiles();

    await expect(bootstrapAdmin({ email: " Admin@Example.com ", auth, profiles })).resolves.toEqual({ createdAuthUser: false });

    expect(auth.createUser).not.toHaveBeenCalled();
    expect(profiles.upsertAdmin).toHaveBeenCalledWith({
      id: existingUser.id,
      fullName: "Existing Admin",
      email: "admin@example.com",
      emailNormalized: "admin@example.com",
      role: "ADMIN",
      isActive: true,
    });
  });

  it.each([undefined, "short-value"])('rejects a new user password of "%s" before provider creation', async (password) => {
    const auth = createAuth({ listUsers: vi.fn().mockResolvedValue({ users: [] }) });

    await expect(bootstrapAdmin({ email: "admin@example.com", password, auth, profiles: createProfiles() }))
      .rejects.toThrow("A bootstrap password of at least 12 characters is required to create an Auth user.");
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("creates a new auth user with a password of at least 12 characters", async () => {
    const auth = createAuth({ listUsers: vi.fn().mockResolvedValue({ users: [] }) });

    await expect(bootstrapAdmin({
      email: "admin@example.com",
      password: "temporary-strong-value",
      auth,
      profiles: createProfiles(),
    })).resolves.toEqual({ createdAuthUser: true });

    expect(auth.createUser).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "temporary-strong-value",
      emailConfirm: true,
    });
  });

  it("returns a safe error when provider creation fails", async () => {
    const auth = createAuth({
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      createUser: vi.fn().mockRejectedValue(new Error("provider payload secret-value")),
    });

    await expect(bootstrapAdmin({
      email: "admin@example.com",
      password: "temporary-strong-value",
      auth,
      profiles: createProfiles(),
    })).rejects.toThrow("Unable to create the Supabase Auth user.");
  });

  it("idempotently promotes the profile to active ADMIN", async () => {
    const profiles = createProfiles();

    await bootstrapAdmin({ email: "admin@example.com", auth: createAuth(), profiles });
    await bootstrapAdmin({ email: "admin@example.com", auth: createAuth(), profiles });

    expect(profiles.upsertAdmin).toHaveBeenCalledTimes(2);
    expect(vi.mocked(profiles.upsertAdmin).mock.calls[0]).toEqual(vi.mocked(profiles.upsertAdmin).mock.calls[1]);
  });

  it("compensates a newly created auth user when profile persistence fails", async () => {
    const auth = createAuth({ listUsers: vi.fn().mockResolvedValue({ users: [] }) });
    const profiles = { upsertAdmin: vi.fn().mockRejectedValue(new Error("database detail")) };

    await expect(bootstrapAdmin({
      email: "admin@example.com",
      password: "temporary-strong-value",
      auth,
      profiles,
    })).rejects.toThrow("Unable to persist the administrator profile.");
    expect(auth.deleteUser).toHaveBeenCalledWith(existingUser.id);
  });

  it("surfaces a safe diagnostic when compensation also fails", async () => {
    const sensitive = [existingUser.id, "admin@example.com", "temporary-strong-value", "provider-secret"];
    const auth = createAuth({
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
      deleteUser: vi.fn().mockRejectedValue(new Error(sensitive.join(" "))),
    });
    const profiles = { upsertAdmin: vi.fn().mockRejectedValue(new Error("database detail")) };

    const failure = bootstrapAdmin({
      email: sensitive[1],
      password: sensitive[2],
      auth,
      profiles,
    }).catch((error: unknown) => error);

    await expect(failure).resolves.toMatchObject({ code: "BOOTSTRAP_COMPENSATION_FAILED" });
    const error = (await failure) as Error;
    expect(error.message).toContain("Remove the newly created Auth user before retrying");
    expect(sensitive.some((value) => error.message.includes(value))).toBe(false);
  });

  it("does not delete an existing auth user when profile persistence fails", async () => {
    const auth = createAuth();
    const profiles = { upsertAdmin: vi.fn().mockRejectedValue(new Error("database detail")) };

    await expect(bootstrapAdmin({ email: "admin@example.com", auth, profiles }))
      .rejects.toThrow("Unable to persist the administrator profile.");
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
});

describe("runBootstrapAdminCli", () => {
  it.each(["success", "failure"])("disconnects Prisma and emits no credentials on %s", async (outcome) => {
    const sensitive = ["admin@example.com", "temporary-strong-value", "secret-value"];
    const output: string[] = [];
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const execute = outcome === "success"
      ? vi.fn().mockResolvedValue({ createdAuthUser: false })
      : vi.fn().mockRejectedValue(new Error(sensitive.join(" ")));

    const exitCode = await runBootstrapAdminCli({
      execute,
      disconnect,
      logger: {
        info: (message) => output.push(message),
        error: (message) => output.push(message),
      },
    });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(exitCode).toBe(outcome === "success" ? 0 : 1);
    expect(sensitive.some((value) => output.join(" ").includes(value))).toBe(false);
  });

  it("prints the safe compensation diagnostic and still disconnects Prisma", async () => {
    const sensitive = [existingUser.id, "admin@example.com", "temporary-strong-value", "provider-secret"];
    const output: string[] = [];
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const exitCode = await runBootstrapAdminCli({
      execute: vi.fn().mockRejectedValue(new BootstrapError("BOOTSTRAP_COMPENSATION_FAILED")),
      disconnect,
      logger: { info: (message) => output.push(message), error: (message) => output.push(message) },
    });

    expect(exitCode).toBe(1);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(output.join(" ")).toContain("BOOTSTRAP_COMPENSATION_FAILED");
    expect(output.join(" ")).toContain("Remove the newly created Auth user before retrying");
    expect(sensitive.some((value) => output.join(" ").includes(value))).toBe(false);
  });
});
