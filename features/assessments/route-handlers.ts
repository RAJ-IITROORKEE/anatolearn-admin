import { mapApiError } from "@/lib/api/handler";
import { parseEmptyJsonBody } from "@/lib/api/body";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";
import { AssessmentError } from "./domain";
import { answerInputSchema, assessmentAvailabilitySchema, attemptIdSchema, attemptListSchema, startAssessmentSchema } from "./schemas";
import { getAssessmentAvailability, getAttempt, getAttemptResult, listAttempts, retakeAttempt, startAssessment, submitAttempt, updateAttemptAnswer } from "./service";

type AttemptContext = { params: Promise<{ attemptId: string }> };
type AnswerContext = { params: Promise<{ attemptId: string; attemptQuestionId: string }> };

async function handle(request: Request, mutation: boolean, callback: (userId: string, id: string) => Promise<Response>) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
    return await callback(identity.profile.id, id);
  } catch (error) {
    if (error instanceof AssessmentError) return apiError(error.code, error.message, error.status, id, error.details);
    return mapApiError(error, id);
  }
}

async function attemptId(context: AttemptContext | AnswerContext) {
  return attemptIdSchema.parse((await context.params).attemptId);
}

export function assessmentStartHandler(request: Request) {
  return handle(request, true, async (userId, id) => {
    const input = startAssessmentSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await startAssessment(userId, input), { requestId: id }, 201);
  });
}

export function assessmentAvailabilityHandler(request: Request) {
  return handle(request, false, async (_userId, id) => {
    const input = assessmentAvailabilitySchema.parse(await request.json().catch(() => null));
    return apiSuccess(await getAssessmentAvailability(input), { requestId: id });
  });
}

export function attemptAnswerHandler(request: Request, context: AnswerContext) {
  return handle(request, true, async (userId, id) => {
    const params = await context.params;
    const input = answerInputSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await updateAttemptAnswer(attemptIdSchema.parse(params.attemptId), attemptIdSchema.parse(params.attemptQuestionId), userId, input), { requestId: id });
  });
}

export function attemptSubmitHandler(request: Request, context: AttemptContext) {
  return handle(request, true, async (userId, id) => {
    await parseEmptyJsonBody(request);
    return apiSuccess(await submitAttempt(await attemptId(context), userId), { requestId: id });
  });
}

export function attemptDetailHandler(request: Request, context: AttemptContext) {
  return handle(request, false, async (userId, id) => apiSuccess(await getAttempt(await attemptId(context), userId), { requestId: id }));
}

export function attemptResultHandler(request: Request, context: AttemptContext) {
  return handle(request, false, async (userId, id) => apiSuccess(await getAttemptResult(await attemptId(context), userId), { requestId: id }));
}

export function attemptRetakeHandler(request: Request, context: AttemptContext) {
  return handle(request, true, async (userId, id) => {
    await parseEmptyJsonBody(request);
    return apiSuccess(await retakeAttempt(await attemptId(context), userId), { requestId: id }, 201);
  });
}

export function attemptListHandler(request: Request) {
  return handle(request, false, async (userId, id) => {
    const input = attemptListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listAttempts(userId, input);
    return apiSuccess(result.items, { requestId: id, pagination: result.pagination });
  });
}
