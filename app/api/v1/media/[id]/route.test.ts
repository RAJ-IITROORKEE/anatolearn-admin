import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedMedia: vi.fn(),
  resolveRequestIdentity: vi.fn(),
}));

vi.mock("@/features/media/service", () => ({ getPublishedMedia: mocks.getPublishedMedia }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));

import { MediaServiceError } from "@/features/media/domain";
import { GET } from "./route";

const assetId = "10000000-0000-4000-8000-000000000001";
const request = new Request(`https://admin.example/api/v1/media/${assetId}`);
const context = { params: Promise.resolve({ id: assetId }) };

describe("published media GET", () => {
  beforeEach(() => {
    mocks.getPublishedMedia.mockReset();
    mocks.resolveRequestIdentity.mockReset();
  });

  it("requires an active authenticated identity", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(mocks.getPublishedMedia).not.toHaveBeenCalled();
  });

  it("returns 404 when the asset is not eligible published media", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "owner", isActive: true }, user: {}, mode: "bearer" });
    mocks.getPublishedMedia.mockRejectedValue(new MediaServiceError("NOT_FOUND", "Media asset was not found."));
    const response = await GET(request, context);
    expect(response.status).toBe(404);
  });

  it("returns the short-lived signed media DTO for an active identity", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "owner", isActive: true }, user: {}, mode: "cookie" });
    mocks.getPublishedMedia.mockResolvedValue({ id: assetId, signedUrl: "https://signed.example/asset", signedUrlExpiresIn: 300 });
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: assetId, signedUrlExpiresIn: 300 } });
    expect(mocks.getPublishedMedia).toHaveBeenCalledWith(assetId, "owner");
  });

  it("rejects a non-UUID path before database access", async () => {
    mocks.resolveRequestIdentity.mockResolvedValue({ profile: { id: "owner", isActive: true }, user: {}, mode: "bearer" });
    const response = await GET(new Request("https://admin.example/api/v1/media/not-a-uuid"), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(response.status).toBe(400);
    expect(mocks.getPublishedMedia).not.toHaveBeenCalled();
  });

  it("maps unexpected authentication failures to a request-scoped envelope", async () => {
    mocks.resolveRequestIdentity.mockRejectedValue(new Error("provider unavailable"));
    const response = await GET(request, context);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: "INTERNAL_ERROR", requestId: expect.any(String) } });
  });
});
