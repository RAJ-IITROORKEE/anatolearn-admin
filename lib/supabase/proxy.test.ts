import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

import { refreshSupabaseSession } from "./proxy";

describe("Supabase proxy refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves nonce request headers when cookie refresh rebuilds the response", async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll([{
            name: "sb-session",
            value: "refreshed",
            options: { httpOnly: true, path: "/" },
          }]);
        },
      },
    }));
    const requestHeaders = new Headers({ "x-nonce": "nonce-value", "content-security-policy": "script-src 'nonce-nonce-value'" });
    const response = await refreshSupabaseSession(new NextRequest("https://app.example/dashboard"), { requestHeaders });

    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe("nonce-value");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toContain("nonce-nonce-value");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-session=refreshed");
  });
});
