import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const systemId = "10000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({
  listAdmin: vi.fn(),
  getAdminMediaMap: vi.fn(),
}));

vi.mock("@/components/phase3/data", () => ({ listAdmin: mocks.listAdmin }));
vi.mock("@/features/media/service", () => ({ getAdminMediaMap: mocks.getAdminMediaMap }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("../phase3-actions", () => ({ createResource: vi.fn(), trashListResourceAction: vi.fn() }));
vi.mock("@/components/phase3/resource-forms", () => ({
  TopicForm: ({ systems }: { systems: Array<{ id: string; label: string }> }) => (
    <label>Organ system<select aria-label="Organ system">{systems.map((system) => <option key={system.id}>{system.label}</option>)}</select></label>
  ),
}));

import TopicsPage from "./page";
import NewTopicPage from "./new/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminMediaMap.mockResolvedValue(new Map());
  mocks.listAdmin.mockImplementation((resource: string) => Promise.resolve(resource === "organSystem"
    ? { items: [{ id: systemId, name: "Circulatory", slug: "circulatory" }], pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }
    : { items: [], pagination: { page: 1, pageSize: 15, total: 0, totalPages: 0 } }));
});

test("topics exposes a primary add action and a useful empty-state action", async () => {
  render(await TopicsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getAllByRole("link", { name: "Add topic" })).toHaveLength(2);
  for (const link of screen.getAllByRole("link", { name: "Add topic" })) expect(link).toHaveAttribute("href", "/topics/new");
});

test("global topic creation offers organ-system selection", async () => {
  render(await NewTopicPage());

  expect(screen.getByRole("heading", { name: "Add topic" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Organ system" })).toHaveTextContent("Circulatory");
});

test("topic list actions use the system slug returned with the topic instead of a UUID fallback", async () => {
  mocks.listAdmin.mockImplementation((resource: string) => Promise.resolve(resource === "organSystem"
    ? { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }
    : {
        items: [{ id: "20000000-0000-4000-8000-000000000002", organSystemId: systemId, organSystemName: "Circulatory", organSystemSlug: "circulatory", title: "Heart anatomy", slug: "heart-anatomy", summary: null, coverMediaId: null, coverImageUrl: null, displayOrder: 0, status: "DRAFT", createdAt: new Date("2026-07-20T00:00:00.000Z"), updatedAt: new Date("2026-07-20T00:00:00.000Z") }],
        pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      }));

  render(await TopicsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getAllByRole("link", { name: "Edit Heart anatomy" })[0]).toHaveAttribute("href", "/organ-systems/circulatory/topics/heart-anatomy");
});
