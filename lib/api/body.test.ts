import { describe, expect, it } from "vitest";

import { parseEmptyJsonBody } from "./body";

function request(body?: string) {
  return new Request("https://app.example/api/mutation", {
    method: "POST",
    ...(body === undefined ? {} : { body, headers: { "content-type": "application/json" } }),
  });
}

describe("parseEmptyJsonBody", () => {
  it.each([undefined, "", "  ", "{}", " { } "])("accepts an absent or empty object body", async (body) => {
    await expect(parseEmptyJsonBody(request(body))).resolves.toEqual({});
  });

  it.each(["null", "[]", '"value"', "{\"unexpected\":true}", "not-json"])("rejects non-empty or malformed input", async (body) => {
    await expect(parseEmptyJsonBody(request(body))).rejects.toBeDefined();
  });
});
