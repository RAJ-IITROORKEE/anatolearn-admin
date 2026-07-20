import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260721130000_revalidate_attempt_topic_updates/migration.sql"), "utf8");

describe("assessment topic update migration", () => {
  it("revalidates the destination when a link changes topic within one attempt", () => {
    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(sql).toMatch(/IF TG_OP IN \('INSERT', 'UPDATE'\) THEN[\s\S]*PERFORM assert_attempt_topic_scope\(NEW\."attemptId"\)/);
  });
});
