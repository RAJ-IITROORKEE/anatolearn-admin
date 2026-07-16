import "server-only";
import type { PublishStatus } from "@prisma/client";
import { getAdmin as getContent, getAdminBySlug as getContentBySlug, listAdmin as listContent } from "@/features/content/service";
import type { ContentBlock } from "@/features/content/schemas";

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
export type AdminSystem = { id: string; name: string; slug: string; shortDescription: string; longDescription: string | null; coverMediaId: string | null; iconMediaId: string | null; displayOrder: number; isActive: boolean; status: PublishStatus; createdAt: Date; updatedAt: Date };
export type AdminTopic = { id: string; organSystemId: string; title: string; slug: string; summary: string | null; coverMediaId: string | null; displayOrder: number; status: PublishStatus; createdAt: Date; updatedAt: Date };
export type AdminLesson = { id: string; topicId: string; title: string; slug: string; summary: string | null; contentBlocks: ContentBlock[]; estimatedReadingMinutes: number; displayOrder: number; status: PublishStatus; createdAt: Date; updatedAt: Date };
type Input = Parameters<typeof listContent>[1];

export const listSystems = (input: Input) => listContent("organSystem", input) as Promise<{ items: AdminSystem[]; pagination: Pagination }>;
export const listTopics = (input: Input) => listContent("topic", input) as Promise<{ items: AdminTopic[]; pagination: Pagination }>;
export const listLessons = (input: Input) => listContent("contentLesson", input) as Promise<{ items: AdminLesson[]; pagination: Pagination }>;
export const getSystem = (id: string) => getContent("organSystem", id) as Promise<AdminSystem>;
export const getSystemBySlug = (slug: string) => getContentBySlug("organSystem", slug) as Promise<AdminSystem>;
export const getTopic = (id: string) => getContent("topic", id) as Promise<AdminTopic>;
export const getLesson = (id: string) => getContent("contentLesson", id) as Promise<AdminLesson>;

export function listAdmin(resource: "organSystem", input: Input): Promise<{ items: AdminSystem[]; pagination: Pagination }>;
export function listAdmin(resource: "topic", input: Input): Promise<{ items: AdminTopic[]; pagination: Pagination }>;
export function listAdmin(resource: "contentLesson", input: Input): Promise<{ items: AdminLesson[]; pagination: Pagination }>;
export function listAdmin(resource: "organSystem" | "topic" | "contentLesson", input: Input): Promise<unknown> {
  return listContent(resource, input);
}
export function getAdmin(resource: "organSystem", id: string): Promise<AdminSystem>;
export function getAdmin(resource: "topic", id: string): Promise<AdminTopic>;
export function getAdmin(resource: "contentLesson", id: string): Promise<AdminLesson>;
export function getAdmin(resource: "organSystem" | "topic" | "contentLesson", id: string): Promise<unknown> {
  return getContent(resource, id);
}

export function getAdminBySlug(resource: "organSystem", slug: string): Promise<AdminSystem> {
  return getContentBySlug(resource, slug) as Promise<AdminSystem>;
}
