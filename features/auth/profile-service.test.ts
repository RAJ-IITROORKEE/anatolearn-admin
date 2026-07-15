import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ prisma: { profile: { updateMany: mocks.updateMany } } }));

import { syncProfileEmail } from "./profile-service";

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
