import "server-only";

import { Prisma, type AuditAction, type PublishStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { questionDto } from "./dto";
import {
  QuestionError,
  assertQuestionPublishable,
  assertQuestionStatusTransition,
  buildReplacementOptions,
} from "./domain";
import type {
  QuestionCreateInput,
  QuestionListInput,
  QuestionUpdateInput,
} from "./schemas";

type MutationContext = { actorId: string; requestId: string; userAgent?: string | null };
const includeOptions = { options: { orderBy: { displayOrder: "asc" as const } } };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function audit(
  tx: Prisma.TransactionClient,
  context: MutationContext,
  action: AuditAction,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId: context.actorId,
      action,
      entityType: "Question",
      entityId,
      beforeSnapshot: before == null ? Prisma.JsonNull : json(before),
      afterSnapshot: after == null ? Prisma.JsonNull : json(after),
      requestId: context.requestId,
      userAgent: context.userAgent,
    },
  });
}

async function getParent(tx: Prisma.TransactionClient, topicId: string) {
  const topic = await tx.topic.findUnique({
    where: { id: topicId },
    select: { status: true, organSystem: { select: { status: true, isActive: true } } },
  });
  if (!topic) throw new QuestionError("PARENT_NOT_FOUND", "Topic was not found.", 422);
  return topic;
}

async function validateMedia(tx: Prisma.TransactionClient, ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  const rows = await tx.$queryRaw<Array<{ id: string; archivedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "archivedAt" FROM "MediaAsset"
    WHERE "id" IN (${Prisma.join(unique)}) FOR SHARE
  `);
  if (rows.length !== unique.length || rows.some((row) => row.archivedAt !== null)) {
    throw new QuestionError("INVALID_MEDIA_REFERENCE", "A question media reference is absent or archived.", 422);
  }
}

async function validateCandidate(
  tx: Prisma.TransactionClient,
  candidate: { topicId: string; status: PublishStatus; mediaId: string | null; options: Array<{ mediaId: string | null; isCorrect: boolean }> },
) {
  const topic = await getParent(tx, candidate.topicId);
  await validateMedia(tx, [candidate.mediaId, ...candidate.options.map((option) => option.mediaId)]);
  if (candidate.status === "PUBLISHED") {
    assertQuestionPublishable({
      topicStatus: topic.status,
      organSystemStatus: topic.organSystem.status,
      organSystemIsActive: topic.organSystem.isActive,
      mediaEligible: true,
      options: candidate.options,
    });
  }
}

function scalarCreateData(input: QuestionCreateInput) {
  return {
    topicId: input.topicId,
    assessmentType: input.assessmentType,
    questionText: input.questionText,
    mediaId: input.mediaId ?? null,
    explanation: input.explanation,
    difficulty: input.difficulty,
    conceptTag: input.conceptTag ?? null,
  };
}

function scalarUpdateData(input: QuestionUpdateInput): Prisma.QuestionUncheckedUpdateInput {
  const { options: _options, ...data } = input;
  void _options;
  return data;
}

export async function listQuestions(input: QuestionListInput) {
  const where: Prisma.QuestionWhereInput = {
    assessmentType: input.assessmentType,
    topicId: input.topicId,
    difficulty: input.difficulty,
    status: input.status,
    isActive: input.isActive,
    conceptTag: input.conceptTag ? { equals: input.conceptTag, mode: "insensitive" } : undefined,
    topic: input.organSystemId ? { organSystemId: input.organSystemId } : undefined,
    ...(input.q ? { OR: [
      { questionText: { contains: input.q, mode: "insensitive" } },
      { explanation: { contains: input.q, mode: "insensitive" } },
      { conceptTag: { contains: input.q, mode: "insensitive" } },
    ] } : {}),
  };
  const orderBy: Prisma.QuestionOrderByWithRelationInput[] = [
    { [input.sortBy]: input.sortOrder },
    { id: input.sortOrder },
  ];
  const [rows, total] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      include: includeOptions,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.question.count({ where }),
  ]);
  return {
    items: rows.map(questionDto),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

export async function getQuestion(id: string) {
  const row = await prisma.question.findUnique({ where: { id }, include: includeOptions });
  if (!row) throw new QuestionError("NOT_FOUND", "Question was not found.", 404);
  return questionDto(row);
}

export async function createQuestion(input: QuestionCreateInput, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const options = buildReplacementOptions(input.options);
    await validateCandidate(tx, { topicId: input.topicId, status: "DRAFT", mediaId: input.mediaId ?? null, options });
    const created = await tx.question.create({
      data: { ...scalarCreateData(input), options: { create: options } },
      include: includeOptions,
    });
    await audit(tx, context, "CREATE", created.id, null, created);
    return questionDto(created);
  });
}

export async function updateQuestion(id: string, input: QuestionUpdateInput, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Question" WHERE "id" = ${id}::uuid FOR UPDATE`);
    const before = await tx.question.findUnique({ where: { id }, include: includeOptions });
    if (!before) throw new QuestionError("NOT_FOUND", "Question was not found.", 404);
    if (before.status === "ARCHIVED") throw new QuestionError("ARCHIVED", "Archived questions cannot be edited.", 409);

    const options = input.options
      ? buildReplacementOptions(input.options, before.options)
      : before.options.map(({ id: optionId, key, label, displayOrder, optionText, mediaId, isCorrect }) => ({ id: optionId, key, label, displayOrder, optionText, mediaId, isCorrect }));
    const candidate = {
      topicId: input.topicId ?? before.topicId,
      status: before.status,
      mediaId: input.mediaId === undefined ? before.mediaId : input.mediaId,
      options,
    };
    await validateCandidate(tx, candidate);

    if (input.options) await tx.questionOption.deleteMany({ where: { questionId: id } });
    const after = await tx.question.update({
      where: { id },
      data: {
        ...scalarUpdateData(input),
        ...(input.options ? { options: { create: options } } : {}),
      },
      include: includeOptions,
    });
    await audit(tx, context, "UPDATE", id, before, after);
    return questionDto(after);
  });
}

async function setStatusInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  status: PublishStatus,
  context: MutationContext,
) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Question" WHERE "id" = ${id}::uuid FOR UPDATE`);
  const before = await tx.question.findUnique({ where: { id }, include: includeOptions });
  if (!before) throw new QuestionError("NOT_FOUND", "Question was not found.", 404);
  assertQuestionStatusTransition(before.status, status);
  if (before.status === status) return before;
  if (status === "PUBLISHED") {
    await validateCandidate(tx, {
      topicId: before.topicId,
      status,
      mediaId: before.mediaId,
      options: before.options,
    });
  }
  const after = await tx.question.update({ where: { id }, data: { status }, include: includeOptions });
  await audit(tx, context, status === "PUBLISHED" ? "PUBLISH" : status === "ARCHIVED" ? "ARCHIVE" : "UPDATE", id, before, after);
  return after;
}

export async function setQuestionStatus(id: string, status: PublishStatus, context: MutationContext) {
  const row = await prisma.$transaction((tx) => setStatusInTransaction(tx, id, status, context));
  return questionDto(row);
}

export async function archiveQuestion(id: string, context: MutationContext) {
  return setQuestionStatus(id, "ARCHIVED", context);
}

export async function bulkSetQuestionStatus(ids: string[], status: PublishStatus, context: MutationContext) {
  const rows = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (const id of ids) updated.push(await setStatusInTransaction(tx, id, status, context));
    return updated;
  });
  return { items: rows.map(questionDto), count: rows.length };
}

export async function setQuestionActivity(id: string, isActive: boolean, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Question" WHERE "id" = ${id}::uuid FOR UPDATE`);
    const before = await tx.question.findUnique({ where: { id }, include: includeOptions });
    if (!before) throw new QuestionError("NOT_FOUND", "Question was not found.", 404);
    if (before.status === "ARCHIVED") throw new QuestionError("ARCHIVED", "Archived question activity cannot be changed.", 409);
    if (before.isActive === isActive) return questionDto(before);
    const after = await tx.question.update({ where: { id }, data: { isActive }, include: includeOptions });
    await audit(tx, context, isActive ? "ACTIVATE" : "DEACTIVATE", id, before, after);
    return questionDto(after);
  });
}

export async function duplicateQuestion(id: string, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.question.findUnique({ where: { id }, include: includeOptions });
    if (!source) throw new QuestionError("NOT_FOUND", "Question was not found.", 404);
    const options = buildReplacementOptions(source.options.map((option) => ({
      optionText: option.optionText,
      mediaId: option.mediaId,
      isCorrect: option.isCorrect,
    })));
    await validateCandidate(tx, { topicId: source.topicId, status: "DRAFT", mediaId: source.mediaId, options });
    const created = await tx.question.create({
      data: {
        topicId: source.topicId,
        assessmentType: source.assessmentType,
        questionText: source.questionText,
        imageUrl: source.imageUrl,
        mediaId: source.mediaId,
        explanation: source.explanation,
        difficulty: source.difficulty,
        conceptTag: source.conceptTag,
        status: "DRAFT",
        isActive: true,
        options: { create: options },
      },
      include: includeOptions,
    });
    await audit(tx, context, "CREATE", created.id, null, { ...created, duplicatedFromId: source.id });
    return questionDto(created);
  });
}
