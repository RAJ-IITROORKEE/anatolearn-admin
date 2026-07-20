import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { attemptDetailDto } from "@/features/assessments/dto";
import { organSystemDto } from "@/features/content/dto";
import { richTextColors, richTextDocumentSchema, richTextHighlights } from "@/features/content/schemas";
import { learnerFeedbackDto } from "@/features/feedback/dto";
import { flashcardDto } from "@/features/flashcards/dto";
import { deliveryDto, deviceTokenDto, learnerNotificationDto } from "@/features/notifications/dto";
import { TRASH_TYPES } from "@/features/trash/domain";
import { apiError } from "@/lib/api/response";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getMeta } from "@/app/api/v1/meta/route";
import { getOpenApiOperationContract, validateOpenApiContract } from "@/scripts/validate-openapi";

const now = new Date("2026-07-14T00:00:00.000Z");
const openApiSource = readFileSync(resolve(process.cwd(), "docs/openapi.yaml"), "utf8");

function schemaBlock(name: string) {
  const match = openApiSource.match(new RegExp(`^    ${name}:\\r?\\n[\\s\\S]*?(?=^    [A-Za-z0-9_-]+:\\s*$)`, "m"));
  if (!match) throw new Error(`OpenAPI schema ${name} was not found.`);
  return match[0];
}

function inlineEnum(name: string) {
  const match = schemaBlock(name).match(/^\s+enum:\s*\[([^\]]+)\]/m);
  if (!match) throw new Error(`OpenAPI schema ${name} does not have an inline enum.`);
  return match[1].split(",").map((value) => value.trim().replace(/^['"]|['"]$/g, ""));
}

function richMarkColorEnum(markType: "highlight" | "textStyle") {
  const source = schemaBlock("RichTextMark");
  const marker = `const: ${markType}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`OpenAPI rich-text mark ${markType} was not found.`);
  const match = source.slice(start).match(/color:\s*\{\s*type:\s*string,\s*enum:\s*\[([^\]]+)\]/);
  if (!match) throw new Error(`OpenAPI rich-text mark ${markType} does not have a color enum.`);
  return match[1].split(",").map((value) => value.trim().replace(/^['"]|['"]$/g, ""));
}

function jsonExamples(name: string) {
  return [...schemaBlock(name).matchAll(/^\s+- (\{.*\})\s*$/gm)].map((match) => JSON.parse(match[1]) as unknown);
}

function objectKeys(value: unknown, path = "data"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => objectKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [`${path}.${key}`, ...objectKeys(child, `${path}.${key}`)]);
}

describe("OpenAPI/runtime contract", () => {
  it("has exact route parity, resolvable refs, unique IDs, and complete JSON response headers", () => {
    expect(validateOpenApiContract()).toEqual({ operations: 113, operationIds: 113 });
  });

  it("keeps the OpenAPI TrashType enum aligned with the domain contract", () => {
    expect(inlineEnum("TrashType")).toEqual([...TRASH_TYPES]);
  });

  it("keeps mixed-attempt and snapshot system nullability aligned with runtime DTOs", () => {
    expect(schemaBlock("AttemptQuestionSafe")).toContain("organSystemId: { type: string, format: uuid }");
    expect(schemaBlock("AttemptBase")).toMatch(/organSystemId: \{ type: \[string, 'null'\], format: uuid(?:,| \})/);
  });

  it("documents the per-topic assessment start failure", () => {
    const operation = openApiSource.match(/^  \/assessments\/start:\r?\n[\s\S]*?(?=^  \/)/m)?.[0];
    expect(operation).toContain("TOPIC_HAS_NO_QUESTIONS");
  });

  it("keeps rich-text color and highlight enums aligned with runtime validation", () => {
    const colors = richMarkColorEnum("textStyle");
    const highlights = richMarkColorEnum("highlight");
    expect(colors).toHaveLength(richTextColors.length);
    expect(highlights).toHaveLength(richTextHighlights.length);
    expect(new Set(colors)).toEqual(new Set(richTextColors));
    expect(new Set(highlights)).toEqual(new Set(richTextHighlights));
  });

  it("documents unambiguous semantic examples for both rich-list node types", () => {
    const richTextNode = schemaBlock("RichTextNode");
    const listRefs = [...richTextNode.matchAll(/#\/components\/schemas\/(Rich(?:Bullet|Ordered)?List)/g)].map((match) => match[1]);
    expect(listRefs).toEqual(["RichList"]);

    expect(schemaBlock("RichList")).toContain("type: { type: string, enum: [bulletList, orderedList] }");
    const examples = jsonExamples("RichList");
    expect(examples.map((example) => (example as { type?: unknown }).type)).toEqual(["bulletList", "orderedList"]);
    for (const example of examples) {
      expect(richTextDocumentSchema.safeParse({ type: "doc", content: [example] }).success).toBe(true);
    }
  });

  it("matches representative runtime statuses and schemas to response components", async () => {
    expect(getOpenApiOperationContract("GET /health")).toEqual({
      operationId: "getHealth",
      responses: { "200": "HealthSuccess" },
    });
    expect(getOpenApiOperationContract("GET /meta")).toEqual({
      operationId: "getMeta",
      responses: { "200": "MetaSuccess" },
    });
    expect(getOpenApiOperationContract("POST /auth/register")?.responses).toMatchObject({
      "202": "RegisterSuccess", "400": "BadRequest", "429": "RateLimited", "503": "InternalError",
    });
    expect(getOpenApiOperationContract("POST /auth/verify-signup-otp")?.responses).toMatchObject({
      "200": "SignupOtpVerifiedSuccess", "400": "BadRequest", "429": "RateLimited", "503": "InternalError",
    });
    expect(getOpenApiOperationContract("POST /auth/resend-signup-otp")?.responses).toMatchObject({
      "202": "RegisterSuccess", "400": "BadRequest", "429": "RateLimited", "503": "InternalError",
    });
    expect(getOpenApiOperationContract("POST /me/device-tokens")?.responses).toMatchObject({
      "201": "DeviceTokenSuccess", "429": "RateLimited",
    });
    expect(getOpenApiOperationContract("POST /attempts/{attemptId}/submit")?.responses).toMatchObject({
      "200": "AttemptResultSuccess", "400": "BadRequest",
    });
    expect(getOpenApiOperationContract("GET /admin/trash")?.responses).toMatchObject({
      "200": "TrashListSuccess", "400": "BadRequest", "401": "Unauthorized", "403": "Forbidden",
    });
    expect(getOpenApiOperationContract("POST /admin/trash/{type}/{id}/restore")?.responses).toMatchObject({
      "200": "TrashRestoreSuccess", "404": "NotFound", "409": "Conflict",
    });
    expect(getOpenApiOperationContract("GET /trash/purge")?.responses).toMatchObject({
      "200": "TrashPurgeSuccess", "401": "CronUnauthorized", "503": "CronUnavailable",
    });

    const health = getHealth();
    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("public, max-age=30");
    expect(health.headers.has("vary")).toBe(false);
    await expect(health.json()).resolves.toMatchObject({ success: true, data: { status: "ok" }, meta: { requestId: expect.any(String) } });

    const meta = getMeta();
    expect(meta.status).toBe(200);
    expect(meta.headers.get("cache-control")).toBe("public, max-age=300");
    expect(meta.headers.has("vary")).toBe(false);
    await expect(meta.json()).resolves.toMatchObject({ success: true, data: { apiVersion: "v1" }, meta: { requestId: expect.any(String) } });

    const error = apiError("VALIDATION_ERROR", "Invalid request.", 400, crypto.randomUUID());
    expect(error.status).toBe(400);
    expect(error.headers.get("cache-control")).toBe("private, no-store");
    expect(error.headers.get("vary")).toBe("Authorization, Cookie");
    await expect(error.json()).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR", requestId: expect.any(String) } });
  });

  it("keeps representative learner/public builders free of denied private fields", () => {
    const attempt = attemptDetailDto({
      id: "attempt", assessmentType: "QUIZ", organSystemId: "system", requestedQuestionCount: 1, totalQuestionCount: 1,
      correctCount: 1, incorrectCount: 0, unansweredCount: 0, scorePercentage: 100, durationSeconds: null,
      timeLimitSeconds: null, startedAt: now, expiresAt: null, completedAt: null, status: "IN_PROGRESS", retakeSourceId: null,
      topics: [{ topicId: "topic" }], questions: [{
        id: "question", displayOrder: 1, questionTextSnapshot: "Prompt", imageUrlSnapshot: null, mediaIdSnapshot: null,
        explanationSnapshot: "private", optionsSnapshot: [
          { key: "a", label: "A", displayOrder: 1, optionText: "A", imageUrl: null, mediaId: null },
          { key: "b", label: "B", displayOrder: 2, optionText: "B", imageUrl: null, mediaId: null },
        ], correctOptionKey: "a", answeredOptionKey: null, isCorrect: null, answeredAt: null, timeSpentSeconds: null,
        topicIdSnapshot: "topic", topicTitleSnapshot: "Topic", difficultySnapshot: "EASY", conceptTagSnapshot: null,
        organSystemIdSnapshot: "system", organSystemNameSnapshot: "System",
      }],
    });
    const outputs = [
      organSystemDto({ id: "system", name: "System", slug: "system", shortDescription: "Summary", longDescription: null, coverImageUrl: null, coverMediaId: null, iconImageUrl: null, iconMediaId: null, displayOrder: 0, status: "PUBLISHED", isActive: true, createdAt: now, updatedAt: now }),
      flashcardDto({ id: "card", topicId: "topic", frontText: "Front", backText: "Back", frontImageUrl: null, frontMediaId: null, backImageUrl: null, backMediaId: null, difficulty: "EASY", notes: "private", displayOrder: 0, status: "PUBLISHED", createdAt: now, updatedAt: now }),
      learnerFeedbackDto({ id: "feedback", type: "GENERAL", subject: "Subject", message: "Message", status: "NEW", createdAt: now, updatedAt: now }),
      learnerNotificationDto({ id: "recipient", readAt: null, createdAt: now, campaign: { type: "ANNOUNCEMENT", title: "Title", message: "Message", sentAt: now } }),
      deviceTokenDto({ id: "device", platform: "IOS", isActive: true, lastSeenAt: now, expoPushToken: "secret" }),
      deliveryDto({ id: "delivery", status: "PENDING", attemptCount: 0, providerErrorCode: null, createdAt: now, updatedAt: now, tokenSnapshot: "secret" }),
      attempt,
    ];
    const keys = outputs.flatMap((output, index) => objectKeys(output, `output[${index}]`));
    const denied = /(?:^|\.)(?:role|emailNormalized|bucket|path|expoPushToken|tokenSnapshot|deviceToken|processingToken|processingLeaseUntil|leaseToken|notes|adminNotes|correctOptionKey|isCorrect|explanation)$/i;
    expect(keys.filter((key) => denied.test(key))).toEqual([]);
    expect(outputs[2]).not.toHaveProperty("rating");
  });
});
