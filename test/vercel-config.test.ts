import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  it("runs functions in the same Mumbai region as Supabase", async () => {
    const config = JSON.parse(await readFile(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      $schema?: string;
      regions?: string[];
    };

    expect(config.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(config.regions).toEqual(["bom1"]);
  });
});
