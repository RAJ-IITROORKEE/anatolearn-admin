import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentError } from "@/features/content/domain";

const lessonId = "00000003-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({
  getAdminLessonBySlugs: vi.fn(),
  getAdminLessonRouteById: vi.fn(),
  getAdminMediaMap: vi.fn(),
  listAdmin: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/components/app-shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/phase3/action-form", () => ({ InlineAction: () => null }));
vi.mock("@/components/phase3/admin-ui", () => ({ StatusBadge: () => null }));
vi.mock("@/components/phase3/data", () => ({
  getAdminLessonBySlugs: mocks.getAdminLessonBySlugs,
  getAdminLessonRouteById: mocks.getAdminLessonRouteById,
  listAdmin: mocks.listAdmin,
}));
vi.mock("@/components/phase3/resource-forms", () => ({
  LessonForm: ({ existingMedia }: { existingMedia: Record<string, { signedUrl: string }> }) => (
    <div>Lesson editor {existingMedia["lesson-media"]?.signedUrl}</div>
  ),
}));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("../phase3-actions", () => ({ changeResourceStatus: vi.fn(), trashResourceAction: vi.fn(), updateResource: vi.fn() }));

import LegacyContentPage from "./[id]/page";
import CanonicalContentPage from "../organ-systems/[slug]/topics/[topicSlug]/content/[lessonSlug]/page";

const lesson = {
  id: lessonId,
  topicId: "00000002-0000-4000-8000-000000000001",
  title: "Heart anatomy",
  slug: "heart-anatomy",
  summary: null,
  contentBlocks: [{ type: "image", mediaId: "lesson-media", altText: "Heart" }],
  estimatedReadingMinutes: 5,
  displayOrder: 0,
  status: "DRAFT",
  organSystemSlug: "circulatory",
  topicSlug: "heart-anatomy",
};

describe("canonical content detail page routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminLessonBySlugs.mockResolvedValue(lesson);
    mocks.getAdminLessonRouteById.mockResolvedValue(lesson);
    mocks.listAdmin.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
    mocks.getAdminMediaMap.mockResolvedValue(new Map([
      ["lesson-media", { signedUrl: "https://signed.example/lesson" }],
    ]));
  });

  it.each([
    { slug: "Bad-Slug", topicSlug: "heart-anatomy", lessonSlug: "overview" },
    { slug: "circulatory", topicSlug: "../heart", lessonSlug: "overview" },
    { slug: "circulatory", topicSlug: "heart-anatomy", lessonSlug: "Overview" },
  ])("rejects malformed canonical slug params before querying content", async (params) => {
    await expect(CanonicalContentPage({ params: Promise.resolve(params) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getAdminLessonBySlugs).not.toHaveBeenCalled();
  });

  it("maps the known content NOT_FOUND response to not found", async () => {
    mocks.getAdminLessonBySlugs.mockRejectedValue(new ContentError("NOT_FOUND", "Content was not found.", 404));

    await expect(CanonicalContentPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy", lessonSlug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("resolves the lesson in its full slug scope and passes signed block media to the editor", async () => {
    render(await CanonicalContentPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy", lessonSlug: "heart-anatomy" }) }));

    expect(mocks.getAdminLessonBySlugs).toHaveBeenCalledWith("circulatory", "heart-anatomy", "heart-anatomy");
    expect(mocks.getAdminMediaMap).toHaveBeenCalledWith(["lesson-media"]);
    expect(screen.getByRole("heading", { name: "Heart anatomy" })).toBeVisible();
    expect(screen.getByText(/https:\/\/signed\.example\/lesson/)).toBeVisible();
  });

  it("propagates invalid stored content to the error boundary", async () => {
    const error = new ContentError("INVALID_STORED_CONTENT", "Invalid stored lesson.", 500);
    mocks.getAdminLessonBySlugs.mockRejectedValue(error);

    await expect(CanonicalContentPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy", lessonSlug: "heart-anatomy" }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("propagates unexpected database failures to the error boundary", async () => {
    const error = new Error("database unavailable");
    mocks.getAdminLessonBySlugs.mockRejectedValue(error);

    await expect(CanonicalContentPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy", lessonSlug: "heart-anatomy" }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("legacy UUID content route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminLessonRouteById.mockResolvedValue(lesson);
  });

  it("rejects an invalid UUID before querying content", async () => {
    await expect(LegacyContentPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getAdminLessonRouteById).not.toHaveBeenCalled();
  });

  it("redirects a UUID to the lesson's current canonical route", async () => {
    await expect(LegacyContentPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toThrow(
      "NEXT_REDIRECT:/organ-systems/circulatory/topics/heart-anatomy/content/heart-anatomy",
    );
    expect(mocks.getAdminLessonRouteById).toHaveBeenCalledWith(lessonId);
  });

  it("maps only a domain NOT_FOUND response to not found", async () => {
    mocks.getAdminLessonRouteById.mockRejectedValue(new ContentError("NOT_FOUND", "Content was not found.", 404));
    await expect(LegacyContentPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("propagates operational lookup failures", async () => {
    const error = new Error("database unavailable");
    mocks.getAdminLessonRouteById.mockRejectedValue(error);
    await expect(LegacyContentPage({ params: Promise.resolve({ id: lessonId }) })).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
