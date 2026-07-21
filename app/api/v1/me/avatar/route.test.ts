import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), replace: vi.fn(), remove: vi.fn(), allow: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolve }));
vi.mock("@/features/profile/avatar-service", () => ({
  replaceManagedAvatar: mocks.replace,
  deleteManagedAvatar: mocks.remove,
  AvatarError: class AvatarError extends Error {
    constructor(public code: string, message: string, public status = 400) { super(message); }
  },
}));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: mocks.allow }));

import { DELETE, PUT } from "./route";

const profileId = crypto.randomUUID();
function request(method: "PUT" | "DELETE", form?: FormData) {
  return { method, url: "https://app.example/api/v1/me/avatar", headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }), formData: async () => form } as Request;
}

describe("managed avatar route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({ profile: { id: profileId }, mode: "bearer" });
    mocks.allow.mockResolvedValue(true);
  });

  it("accepts exactly one server-owned multipart file", async () => {
    const body = new FormData();
    body.append("file", new File([new Uint8Array([1])], "avatar.png", { type: "image/png" }));
    const response = await PUT(request("PUT", body));
    expect(response.status).toBe(200);
    expect(mocks.replace).toHaveBeenCalledWith(profileId, expect.any(File), expect.any(String));
  });

  it("rejects duplicate files and unknown multipart fields", async () => {
    const body = new FormData();
    body.append("file", new File([new Uint8Array([1])], "a.png", { type: "image/png" }));
    body.append("file", new File([new Uint8Array([2])], "b.png", { type: "image/png" }));
    body.append("actorId", crypto.randomUUID());
    const response = await PUT(request("PUT", body));
    expect(response.status).toBe(400);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("maps wrong or malformed multipart to a safe 400 envelope", async () => {
    const wrongType = new Request("https://app.example/api/v1/me/avatar", {
      method: "PUT", headers: { "content-type": "application/json" }, body: "{}",
    });
    const wrongResponse = await PUT(wrongType);
    expect(wrongResponse.status).toBe(400);

    const malformed = {
      method: "PUT", url: "https://app.example/api/v1/me/avatar",
      headers: new Headers({ "content-type": "multipart/form-data; boundary=broken" }),
      formData: vi.fn().mockRejectedValue(new TypeError("provider parser detail")),
    } as unknown as Request;
    const malformedResponse = await PUT(malformed);
    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.text()).not.toContain("provider parser detail");
  });

  it("maps invalid upload content to 422 and storage outages to a safe 503", async () => {
    const body = new FormData();
    body.append("file", new File([new Uint8Array([1])], "avatar.png", { type: "image/png" }));
    const { AvatarError } = await import("@/features/profile/avatar-service");
    mocks.replace.mockRejectedValueOnce(new AvatarError("INVALID_FILE", "provider image detail", 400));
    const invalid = await PUT(request("PUT", body));
    expect(invalid.status).toBe(422);
    expect(await invalid.text()).not.toContain("provider image detail");

    mocks.replace.mockRejectedValueOnce(new AvatarError("STORAGE_ERROR", "provider storage detail", 503));
    const unavailable = await PUT(request("PUT", body));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("provider storage detail");
  });

  it("clears the authenticated user's avatar and enforces rate limiting", async () => {
    expect((await DELETE(request("DELETE"))).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(profileId, expect.any(String));
    mocks.allow.mockResolvedValue(false);
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(429);
  });

  it("requires active authentication and safe origin for cookie mutations", async () => {
    mocks.resolve.mockResolvedValueOnce(null);
    expect((await DELETE(request("DELETE"))).status).toBe(401);
    mocks.resolve.mockResolvedValueOnce({ profile: { id: profileId }, mode: "cookie" });
    expect((await DELETE(request("DELETE"))).status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
