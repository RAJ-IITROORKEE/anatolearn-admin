import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authClient: vi.fn(), serverClient: vi.fn(), findProfile: vi.fn() }));
vi.mock("@/lib/supabase/auth-client", () => ({ createSupabaseAuthClient: mocks.authClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.serverClient }));
vi.mock("@/features/auth/profile-service", () => ({ findProfileForUser: mocks.findProfile }));

import { resolveRequestIdentity } from "./request";

function token(method: string) {
  return `x.${Buffer.from(JSON.stringify({ amr: [{ method }] })).toString("base64url")}.x`;
}

describe("request identity recovery-token boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findProfile.mockResolvedValue({ id: "user-id", isActive: true });
  });

  it("rejects a recovery bearer before resolving normal application identity", async () => {
    const getUser = vi.fn();
    mocks.authClient.mockReturnValue({ auth: { getUser } });
    await expect(resolveRequestIdentity(new Request("https://app.example/api/v1/me", {
      headers: { authorization: `Bearer ${token("recovery")}` },
    }))).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
    expect(mocks.findProfile).not.toHaveBeenCalled();
  });

  it("rejects a recovery cookie session but accepts a provider-verified password session", async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce({ data: { session: { access_token: token("recovery") } } })
      .mockResolvedValueOnce({ data: { session: { access_token: token("password") } } });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.serverClient.mockResolvedValue({ auth: { getSession, getUser } });

    await expect(resolveRequestIdentity(new Request("https://app.example/api/v1/me"))).resolves.toBeNull();
    await expect(resolveRequestIdentity(new Request("https://app.example/api/v1/me"))).resolves.toMatchObject({ mode: "cookie", profile: { id: "user-id" } });
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
