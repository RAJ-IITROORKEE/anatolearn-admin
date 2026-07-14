import type { ContentLesson, OrganSystem, Topic } from "@prisma/client";
import { contentBlocksSchema } from "./schemas";
import { ContentError } from "./domain";

type OrganSystemDtoSource = Omit<OrganSystem, "trashedAt" | "purgeAfter" | "nextPurgeAttemptAt">;
type TopicDtoSource = Omit<Topic, "trashedAt" | "purgeAfter" | "nextPurgeAttemptAt">;
type ContentLessonDtoSource = Omit<ContentLesson, "trashedAt" | "purgeAfter" | "nextPurgeAttemptAt">;

export function organSystemDto(value: OrganSystemDtoSource, admin = false) {
  return { id: value.id, name: value.name, slug: value.slug, shortDescription: value.shortDescription, longDescription: value.longDescription, coverImageUrl: value.coverImageUrl, iconImageUrl: value.iconImageUrl, displayOrder: value.displayOrder, isActive: value.isActive, ...(admin ? { status: value.status, coverMediaId: value.coverMediaId, iconMediaId: value.iconMediaId, createdAt: value.createdAt, updatedAt: value.updatedAt } : {}) };
}

export function topicDto(value: TopicDtoSource, admin = false) {
  return { id: value.id, organSystemId: value.organSystemId, title: value.title, slug: value.slug, summary: value.summary, coverImageUrl: value.coverImageUrl, displayOrder: value.displayOrder, ...(admin ? { status: value.status, coverMediaId: value.coverMediaId, createdAt: value.createdAt, updatedAt: value.updatedAt } : {}) };
}

export function lessonDto(value: ContentLessonDtoSource, admin = false) {
  const blocks = contentBlocksSchema.safeParse(value.contentBlocks);
  if (!blocks.success) throw new ContentError("INVALID_STORED_CONTENT", "Lesson content is invalid.", 500);
  return { id: value.id, topicId: value.topicId, title: value.title, slug: value.slug, summary: value.summary, contentBlocks: blocks.data, estimatedReadingMinutes: value.estimatedReadingMinutes, displayOrder: value.displayOrder, ...(admin ? { status: value.status, createdAt: value.createdAt, updatedAt: value.updatedAt } : {}) };
}
