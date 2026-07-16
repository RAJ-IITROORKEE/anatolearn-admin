import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("media metadata migration", () => {
  it("allows empty alt text while retaining file metadata checks", async () => {
    const sql = await readFile(path.join(
      process.cwd(),
      "prisma/migrations/20260716123000_allow_empty_media_alt_text/migration.sql",
    ), "utf8");

    expect(sql).toContain('DROP CONSTRAINT "MediaAsset_metadata_check"');
    expect(sql).toContain('"byteSize" > 0');
    expect(sql).toContain('"width" > 0 AND "height" > 0');
    expect(sql).not.toContain('btrim("altText")');
  });
});
