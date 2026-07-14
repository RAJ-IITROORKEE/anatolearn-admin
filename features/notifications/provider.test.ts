import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpoPushProvider, ProviderPermanentError, ProviderTransientError, providerConfigSchema } from "./provider";

describe("Expo provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is ready only when enabled and a token is present", () => {
    expect(providerConfigSchema.parse({ EXPO_PUSH_ENABLED: "false" }).ready).toBe(false);
    expect(providerConfigSchema.parse({ EXPO_PUSH_ENABLED: "true" }).ready).toBe(false);
    expect(providerConfigSchema.parse({ EXPO_PUSH_ENABLED: "true", EXPO_ACCESS_TOKEN: "token" }).ready).toBe(true);
  });

  it("maps an accepted ticket to TICKETED rather than SENT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }), { status: 200 })));
    const provider = new ExpoPushProvider("access-token");
    await expect(provider.send([{ to: "ExpoPushToken[value]", title: "Title", body: "Body" }])).resolves.toEqual([
      { status: "TICKETED", receiptId: "ticket-1" },
    ]);
  });

  it("parses ticket and receipt errors without returning raw provider payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "error", message: "bad", details: { error: "DeviceNotRegistered" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { "ticket-1": { status: "ok" }, "ticket-2": { status: "error", message: "bad", details: { error: "MessageRateExceeded" } } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new ExpoPushProvider("access-token");
    await expect(provider.send([{ to: "ExpoPushToken[value]", title: "Title", body: "Body" }])).resolves.toEqual([
      { status: "FAILED", code: "DeviceNotRegistered", message: "bad" },
    ]);
    await expect(provider.receipts(["ticket-1", "ticket-2"])).resolves.toEqual({
      "ticket-1": { status: "SENT" },
      "ticket-2": { status: "FAILED", code: "MessageRateExceeded", message: "bad" },
    });
  });

  it("rejects batches over 100", async () => {
    const provider = new ExpoPushProvider("access-token");
    await expect(provider.send(Array.from({ length: 101 }, () => ({ to: "ExpoPushToken[value]", title: "T", body: "B" })))).rejects.toThrow();
  });

  it.each([400, 401, 403])("types HTTP %s as permanent", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rejected", { status })));
    await expect(new ExpoPushProvider("token").send([{ to: "token", title: "T", body: "B" }]))
      .rejects.toBeInstanceOf(ProviderPermanentError);
  });

  it.each([429, 500])("types HTTP %s as transient", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status })));
    await expect(new ExpoPushProvider("token").send([{ to: "token", title: "T", body: "B" }]))
      .rejects.toBeInstanceOf(ProviderTransientError);
  });

  it("types malformed successful responses as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(new ExpoPushProvider("token").send([{ to: "token", title: "T", body: "B" }]))
      .rejects.toBeInstanceOf(ProviderPermanentError);
  });
});
