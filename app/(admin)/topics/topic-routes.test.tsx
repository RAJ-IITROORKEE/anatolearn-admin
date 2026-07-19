import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { ContentError } from "@/features/content/domain";

const topicId = "20000000-0000-4000-8000-000000000002";
const systemId = "10000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getAdminBySlug: vi.fn(),
  getAdminTopicBySlugs: vi.fn(),
  listAdmin: vi.fn(),
  getAdminMediaMap: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/components/phase3/data", () => ({
  getAdmin: mocks.getAdmin,
  getAdminBySlug: mocks.getAdminBySlug,
  getAdminTopicBySlugs: mocks.getAdminTopicBySlugs,
  listAdmin: mocks.listAdmin,
}));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("@/components/phase3/resource-forms", () => ({ TopicForm: () => <div>Topic editor</div> }));
vi.mock("@/components/phase3/action-form", () => ({ InlineAction: () => null }));
vi.mock("../phase3-actions", () => ({ changeResourceStatus: vi.fn(), trashResourceAction: vi.fn(), updateResource: vi.fn() }));

import LegacyTopicPage from "./[id]/page";
import CanonicalTopicPage from "../organ-systems/[slug]/topics/[topicSlug]/page";

const topic = { id: topicId, organSystemId: systemId, title: "Heart anatomy", slug: "heart-anatomy", summary: null, coverMediaId: null, coverImageUrl: null, displayOrder: 0, status: "DRAFT" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdmin.mockImplementation((resource: string) => Promise.resolve(resource === "topic"
    ? topic
    : { id: systemId, name: "Circulatory", slug: "circulatory" }));
  mocks.getAdminBySlug.mockResolvedValue({ id: systemId, name: "Circulatory", slug: "circulatory" });
  mocks.getAdminTopicBySlugs.mockResolvedValue(topic);
  mocks.listAdmin.mockResolvedValue({ items: [{ id: systemId, name: "Circulatory", slug: "circulatory" }], pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } });
  mocks.getAdminMediaMap.mockResolvedValue(new Map());
});

test("legacy UUID topic route redirects to the readable canonical route", async () => {
  await expect(LegacyTopicPage({ params: Promise.resolve({ id: topicId }) })).rejects.toThrow(
    "NEXT_REDIRECT:/organ-systems/circulatory/topics/heart-anatomy",
  );
});

test("canonical topic route resolves the topic under both slugs", async () => {
  render(await CanonicalTopicPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy" }) }));

  expect(mocks.getAdminTopicBySlugs).toHaveBeenCalledWith("circulatory", "heart-anatomy");
  expect(screen.getByRole("heading", { name: "Heart anatomy" })).toBeVisible();
  expect(screen.getByText("Topic editor")).toBeVisible();
});

test("legacy topic route rejects a malformed UUID before any lookup", async () => {
  await expect(LegacyTopicPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");

  expect(mocks.getAdmin).not.toHaveBeenCalled();
});

test("legacy topic route maps a known topic NOT_FOUND error to not found", async () => {
  mocks.getAdmin.mockRejectedValue(new ContentError("NOT_FOUND", "Topic was not found.", 404));

  await expect(LegacyTopicPage({ params: Promise.resolve({ id: topicId }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.notFound).toHaveBeenCalledOnce();
});

test("legacy topic route propagates an unexpected topic lookup failure", async () => {
  const error = new Error("database unavailable");
  mocks.getAdmin.mockRejectedValue(error);

  await expect(LegacyTopicPage({ params: Promise.resolve({ id: topicId }) })).rejects.toBe(error);
  expect(mocks.notFound).not.toHaveBeenCalled();
});

test("legacy topic route maps a known parent NOT_FOUND error to not found", async () => {
  mocks.getAdmin.mockImplementation((resource: string) => resource === "topic"
    ? Promise.resolve(topic)
    : Promise.reject(new ContentError("NOT_FOUND", "Content was not found.", 404)));

  await expect(LegacyTopicPage({ params: Promise.resolve({ id: topicId }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.getAdmin).toHaveBeenNthCalledWith(2, "organSystem", systemId);
});

test("legacy topic route propagates an unexpected parent lookup failure", async () => {
  const error = new Error("parent lookup failed");
  mocks.getAdmin.mockImplementation((resource: string) => resource === "topic"
    ? Promise.resolve(topic)
    : Promise.reject(error));

  await expect(LegacyTopicPage({ params: Promise.resolve({ id: topicId }) })).rejects.toBe(error);
  expect(mocks.notFound).not.toHaveBeenCalled();
});

test("canonical topic route maps a known NOT_FOUND error to not found", async () => {
  mocks.getAdminTopicBySlugs.mockRejectedValue(new ContentError("NOT_FOUND", "Topic was not found.", 404));

  await expect(CanonicalTopicPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.notFound).toHaveBeenCalledOnce();
});

test("canonical topic route propagates invalid stored content", async () => {
  const error = new ContentError("INVALID_STORED_CONTENT", "Stored topic is invalid.", 500);
  mocks.getAdminTopicBySlugs.mockRejectedValue(error);

  await expect(CanonicalTopicPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy" }) })).rejects.toBe(error);
  expect(mocks.notFound).not.toHaveBeenCalled();
});

test("canonical topic route propagates unexpected database failures", async () => {
  const error = new Error("database unavailable");
  mocks.getAdminTopicBySlugs.mockRejectedValue(error);

  await expect(CanonicalTopicPage({ params: Promise.resolve({ slug: "circulatory", topicSlug: "heart-anatomy" }) })).rejects.toBe(error);
  expect(mocks.notFound).not.toHaveBeenCalled();
});
