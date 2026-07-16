import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { QuestionError } from "./domain";
import {
  questionActivitySchema,
  questionBulkStatusSchema,
  questionCreateSchema,
  questionIdSchema,
  questionListSchema,
  questionStatusSchema,
  questionUpdateSchema,
} from "./schemas";
import {
  archiveQuestion,
  bulkSetQuestionStatus,
  createQuestion,
  duplicateQuestion,
  getQuestion,
  listQuestions,
  setQuestionActivity,
  setQuestionStatus,
  updateQuestion,
} from "./service";
import { cleanupDirectUploads, directUploadContext, formBoolean, formNullable, formValue, resolveMediaField } from "@/features/media/direct-upload";

type RouteContext = { params: Promise<{ id: string }> };

function mutationContext(request: Request, actorId: string, requestId: string) {
  return { actorId, requestId, userAgent: request.headers.get("user-agent") };
}

async function multipartInput(request: Request, actorId: string, requestId: string) {
  const data = await request.formData();
  const uploads = directUploadContext(actorId, requestId, request.headers.get("user-agent"));
  try {
    const count = Number(formValue(data, "optionCount"));
    const correct = Number(formValue(data, "correctOption"));
    return { uploads, input: {
      topicId: formValue(data, "topicId"), assessmentType: formValue(data, "assessmentType"), questionText: formValue(data, "questionText"),
      mediaId: await resolveMediaField(data, { fileKey: "questionFile", altText: formValue(data, "questionAltText"), existingId: formNullable(data, "mediaId"), clear: formBoolean(data, "clearQuestionImage") }, uploads),
      explanation: formValue(data, "explanation"), difficulty: formValue(data, "difficulty"), conceptTag: formNullable(data, "conceptTag"),
      options: Number.isInteger(count) && count >= 0 ? await Promise.all(Array.from({ length: count }, async (_, index) => ({ ...(formValue(data, `optionId.${index}`) ? { id: formValue(data, `optionId.${index}`) } : {}), optionText: formValue(data, `optionText.${index}`), mediaId: await resolveMediaField(data, { fileKey: `optionFile.${index}`, altText: formValue(data, `optionAltText.${index}`), existingId: formNullable(data, `optionMediaId.${index}`), clear: formBoolean(data, `clearOption.${index}`) }, uploads), isCorrect: index === correct }))) : [],
    } };
  } catch (error) { await cleanupDirectUploads(uploads); throw error; }
}

async function handle(
  request: Request,
  mutation: boolean,
  callback: (actorId: string, requestId: string) => Promise<Response>,
) {
  const auth = await requireAdmin(request, mutation);
  if ("response" in auth) return auth.response;
  try {
    return await callback(auth.identity.profile.id, auth.id);
  } catch (error) {
    if (error instanceof QuestionError) {
      return apiError(error.code, error.message, error.status, auth.id, error.details);
    }
    return mapApiError(error, auth.id);
  }
}

async function routeId(context: RouteContext) {
  return questionIdSchema.parse((await context.params).id);
}

export const questionCollectionHandlers = {
  GET(request: Request) {
    return handle(request, false, async (_actorId, requestId) => {
      const input = questionListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
      const result = await listQuestions(input);
      return apiSuccess(result.items, { requestId, pagination: result.pagination });
    });
  },
  POST(request: Request) {
    return handle(request, true, async (actorId, requestId) => {
      let uploads: ReturnType<typeof directUploadContext> | undefined;
      const body: unknown = request.headers.get("content-type")?.includes("multipart/form-data") ? (await multipartInput(request, actorId, requestId).then((parsed) => { uploads = parsed.uploads; return parsed.input; })) : await request.json().catch(() => null);
      const input = questionCreateSchema.parse(body);
      let result;
      try { result = await createQuestion(input, mutationContext(request, actorId, requestId)); } catch (error) { if (uploads) await cleanupDirectUploads(uploads); throw error; }
      return apiSuccess(result, { requestId }, 201);
    });
  },
};

export const questionItemHandlers = {
  GET(request: Request, context: RouteContext) {
    return handle(request, false, async (_actorId, requestId) => {
      return apiSuccess(await getQuestion(await routeId(context)), { requestId });
    });
  },
  PATCH(request: Request, context: RouteContext) {
    return handle(request, true, async (actorId, requestId) => {
      let uploads: ReturnType<typeof directUploadContext> | undefined;
      const body: unknown = request.headers.get("content-type")?.includes("multipart/form-data") ? (await multipartInput(request, actorId, requestId).then((parsed) => { uploads = parsed.uploads; return parsed.input; })) : await request.json().catch(() => null);
      const input = questionUpdateSchema.parse(body);
      let result;
      try { result = await updateQuestion(await routeId(context), input, mutationContext(request, actorId, requestId)); } catch (error) { if (uploads) await cleanupDirectUploads(uploads); throw error; }
      return apiSuccess(result, { requestId });
    });
  },
  DELETE(request: Request, context: RouteContext) {
    return handle(request, true, async (actorId, requestId) => {
      const result = await archiveQuestion(await routeId(context), mutationContext(request, actorId, requestId));
      return apiSuccess(result, { requestId });
    });
  },
};

export function updateQuestionStatusHandler(request: Request, context: RouteContext) {
  return handle(request, true, async (actorId, requestId) => {
    const input = questionStatusSchema.parse(await request.json().catch(() => null));
    const result = await setQuestionStatus(await routeId(context), input.status, mutationContext(request, actorId, requestId));
    return apiSuccess(result, { requestId });
  });
}

export function updateQuestionActivityHandler(request: Request, context: RouteContext) {
  return handle(request, true, async (actorId, requestId) => {
    const input = questionActivitySchema.parse(await request.json().catch(() => null));
    const result = await setQuestionActivity(await routeId(context), input.isActive, mutationContext(request, actorId, requestId));
    return apiSuccess(result, { requestId });
  });
}

export function archiveQuestionHandler(request: Request, context: RouteContext) {
  return handle(request, true, async (actorId, requestId) => {
    const result = await archiveQuestion(await routeId(context), mutationContext(request, actorId, requestId));
    return apiSuccess(result, { requestId });
  });
}

export function duplicateQuestionHandler(request: Request, context: RouteContext) {
  return handle(request, true, async (actorId, requestId) => {
    const result = await duplicateQuestion(await routeId(context), mutationContext(request, actorId, requestId));
    return apiSuccess(result, { requestId }, 201);
  });
}

export function bulkQuestionStatusHandler(request: Request) {
  return handle(request, true, async (actorId, requestId) => {
    const input = questionBulkStatusSchema.parse(await request.json().catch(() => null));
    const result = await bulkSetQuestionStatus(input.ids, input.status, mutationContext(request, actorId, requestId));
    return apiSuccess(result, { requestId });
  });
}
