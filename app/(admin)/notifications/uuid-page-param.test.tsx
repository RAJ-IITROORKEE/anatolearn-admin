import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCampaign: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/notifications/service", () => ({ getCampaign: mocks.getCampaign }));
vi.mock("@/features/notifications/provider", () => ({ getProviderConfig: vi.fn() }));
vi.mock("@/features/users/service", () => ({ listLearners: vi.fn() }));
vi.mock("@/components/notifications/campaign-detail", () => ({ CampaignDetail: () => null }));
vi.mock("@/components/app-shell/page-header", () => ({ PageHeader: () => null }));

import NotificationDetailPage from "./[id]/page";

it("returns 404 for a malformed campaign UUID before loading it", async () => {
  await expect(NotificationDetailPage({ params: Promise.resolve({ id: "bad-id" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.getCampaign).not.toHaveBeenCalled();
});
