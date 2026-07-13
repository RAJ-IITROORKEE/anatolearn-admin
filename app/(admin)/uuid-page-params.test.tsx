import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminAttempt: vi.fn(),
  getAdminUserProgress: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/assessments/admin-service", () => ({ getAdminAttempt: mocks.getAdminAttempt }));
vi.mock("@/features/progress/service", () => ({ getAdminUserProgress: mocks.getAdminUserProgress }));
vi.mock("@/components/assessments/attempt-detail", () => ({ AttemptDetail: () => null }));
vi.mock("@/components/progress/user-progress", () => ({ UserProgress: () => null }));

import AttemptDetailPage from "./attempts/[id]/page";
import UserProgressPage from "./users/[id]/page";

describe("admin detail UUID parameters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not found for a malformed attempt ID before calling the service", async () => {
    await expect(AttemptDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getAdminAttempt).not.toHaveBeenCalled();
  });

  it("returns not found for a malformed user ID before calling progress SQL", async () => {
    await expect(UserProgressPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getAdminUserProgress).not.toHaveBeenCalled();
  });
});
