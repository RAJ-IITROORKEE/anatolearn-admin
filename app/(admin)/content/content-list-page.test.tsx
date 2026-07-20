import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAdmin: vi.fn(),
  getAdminMediaMap: vi.fn(),
}));

vi.mock("@/components/phase3/data", () => ({ listAdmin: mocks.listAdmin }));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("@/components/app-shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/phase3/admin-ui", async () => {
  const React = await import("react");
  return {
    FilterBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResourceCards: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResourceCard: ({ href, title }: { href: string; title: string }) => <a href={href}>{title}</a>,
    StatusBadge: () => null,
    fieldClass: "field",
  };
});
vi.mock("@/components/media/admin-media-thumbnail", () => ({ AdminMediaThumbnail: () => null }));
vi.mock("@/components/shared/pagination", () => ({ Pagination: () => null }));
vi.mock("@/components/shared/empty-state", () => ({ EmptyState: () => null }));

import ContentPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAdmin.mockImplementation((resource: string) => Promise.resolve(resource === "topic"
    ? { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }
    : {
        items: [{
          id: "00000003-0000-4000-8000-000000000001",
          topicId: "00000002-0000-4000-8000-000000000001",
          title: "Overview",
          slug: "overview",
          summary: null,
          contentBlocks: [],
          estimatedReadingMinutes: 2,
          displayOrder: 0,
          status: "DRAFT",
          createdAt: new Date(),
          updatedAt: new Date(),
          organSystemSlug: "circulatory",
          topicSlug: "heart-anatomy",
        }],
        pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      }));
  mocks.getAdminMediaMap.mockResolvedValue(new Map());
});

test("links lessons by system, topic, and lesson slugs rather than collision-prone IDs", async () => {
  render(await ContentPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "href",
    "/organ-systems/circulatory/topics/heart-anatomy/content/overview",
  );
});
