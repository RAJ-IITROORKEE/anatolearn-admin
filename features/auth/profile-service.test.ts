import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), upsert: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ prisma: { profile: { updateMany: mocks.updateMany, upsert: mocks.upsert } } }));

import { provisionUserProfile, syncProfileEmail } from "./profile-service";

describe("syncProfileEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates only the linked profile email fields", async () => {
    await syncProfileEmail({ id: "profile-id", email: " Admin@Example.com " });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: { email: " Admin@Example.com ", emailNormalized: "admin@example.com" },
    });
  });

  it("does nothing when Auth has no email", async () => {
    await syncProfileEmail({ id: "profile-id", email: null });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("provisionUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["", "x", "x".repeat(101), 42])("uses a bounded fallback for invalid user metadata: %s", async (fullName) => {
    mocks.upsert.mockResolvedValue({ id: "user-id" });

    await provisionUserProfile({
      id: "user-id", email: "user@example.com", user_metadata: { full_name: fullName },
    } as never);

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ fullName: "Learner", role: "USER" }),
    }));
  });
});
