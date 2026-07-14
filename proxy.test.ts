import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ refreshSupabaseSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ refreshSupabaseSession: mocks.refreshSupabaseSession }));

import { proxy } from "./proxy";

describe("root proxy security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshSupabaseSession.mockResolvedValue(NextResponse.next());
  });

  it("passes a request nonce to Next and returns the matching CSP", async () => {
    const response = await proxy(new NextRequest("https://app.example/dashboard"));
    const options = mocks.refreshSupabaseSession.mock.calls[0]?.[1] as { requestHeaders: Headers };
    const nonce = options.requestHeaders.get("x-nonce");
    const requestPolicy = options.requestHeaders.get("content-security-policy");

    expect(nonce).toBeTruthy();
    expect(requestPolicy).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("content-security-policy")).toBe(requestPolicy);
  });
});
