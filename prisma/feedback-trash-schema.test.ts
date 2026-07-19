import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migrationName = "20260720120000_add_feedback_trash";

describe("feedback Trash schema", () => {
  it("exposes the complete retention metadata in Prisma", () => {
    const feedback = Prisma.dmmf.datamodel.models.find((model) => model.name === "Feedback");
    expect(feedback?.fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "trashedAt", "purgeAfter", "nextPurgeAttemptAt",
    ]));
  });

  it("adds a new guarded migration without modifying the original safe-trash migration", () => {
    const sql = readFileSync(join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql"), "utf8");
    expect(sql).toContain('ALTER TABLE "Feedback" ADD COLUMN "trashedAt"');
    expect(sql).toContain('CONSTRAINT "Feedback_trash_consistency"');
    expect(sql).toContain('CREATE INDEX "Feedback_trash_due_idx"');
    expect(sql).toContain('CREATE TRIGGER enforce_safe_trash_delete');
    expect(sql).toContain('CREATE TRIGGER enforce_trash_restore_deadline');
  });
});
