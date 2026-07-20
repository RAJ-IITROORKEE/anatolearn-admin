import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260721120000_add_ratings_and_cross_system_assessments/migration.sql"), "utf8");

describe("ratings and cross-system migration", () => {
  it("is atomic", () => {
    expect(sql.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("leaves historical ratings null before installing the future-row default and half-step check", () => {
    expect(sql.indexOf('ADD COLUMN "rating" DECIMAL(2,1)')).toBeLessThan(sql.indexOf('SET DEFAULT 4.5'));
    expect(sql).toMatch(/rating[\s\S]*0\.5[\s\S]*5/);
    expect(sql).toMatch(/rating[\s\S]*2[\s\S]*floor/);
    expect(sql).not.toMatch(/UPDATE "Feedback"[\s\S]*rating/);
  });

  it("makes the singular system nullable and replaces topic-scope enforcement", () => {
    expect(sql).toContain('ALTER COLUMN "organSystemId" DROP NOT NULL');
    expect(sql).toContain('DROP TRIGGER "AssessmentAttemptTopic_scope"');
    expect(sql).toContain("CREATE CONSTRAINT TRIGGER");
    expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
  });

  it("revalidates every affected attempt for link insert, update, delete, and system mutation", () => {
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OR DELETE ON "AssessmentAttemptTopic"/);
    expect(sql).toMatch(/TG_OP IN \('UPDATE', 'DELETE'\)[\s\S]*OLD\."attemptId"/);
    expect(sql).toMatch(/TG_OP IN \('INSERT', 'UPDATE'\)[\s\S]*NEW\."attemptId"/);
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OF "organSystemId" ON "AssessmentAttempt"/);
    expect(sql).toMatch(/system_count = 0/);
  });

});
