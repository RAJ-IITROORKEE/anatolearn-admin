import { describe, expect, it } from "vitest";

import { attemptDetailDto } from "@/features/assessments/dto";
import { organSystemDto } from "@/features/content/dto";
import { learnerFeedbackDto } from "@/features/feedback/dto";
import { flashcardDto } from "@/features/flashcards/dto";
import { deliveryDto, deviceTokenDto, learnerNotificationDto } from "@/features/notifications/dto";
import { apiError } from "@/lib/api/response";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getMeta } from "@/app/api/v1/meta/route";
import { getOpenApiOperationContract, validateOpenApiContract } from "@/scripts/validate-openapi";

const now = new Date("2026-07-14T00:00:00.000Z");

function objectKeys(value: unknown, path = "data"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => objectKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [`${path}.${key}`, ...objectKeys(child, `${path}.${key}`)]);
}

describe("OpenAPI/runtime contract", () => {
  it("has exact route parity, resolvable refs, unique IDs, and complete JSON response headers", () => {
    expect(validateOpenApiContract()).toEqual({ operations: 108, operationIds: 108 });
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
      "201": "RegisterSuccess", "400": "BadRequest", "409": "Conflict", "429": "RateLimited",
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
  });
});
