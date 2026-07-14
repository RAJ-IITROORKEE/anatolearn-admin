import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAdminFeedback: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/feedback/service", () => ({ getAdminFeedback: mocks.getAdminFeedback }));
vi.mock("@/components/phase6/feedback-detail", () => ({ FeedbackDetail: () => null }));

import FeedbackDetailPage from "./[id]/page";

it("returns not found for a malformed feedback ID before loading feedback", async () => {
  await expect(FeedbackDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.getAdminFeedback).not.toHaveBeenCalled();
});
