import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OrganSystemList, TopicList } from "./content-lists";

const updatedAt = new Date("2026-07-20T12:30:00.000Z");
const media = new Map([
  ["cover-id", { id: "cover-id", signedUrl: "https://example.com/cover.png", altText: "Heart cover" }],
  ["icon-id", { id: "icon-id", signedUrl: "https://example.com/icon.png", altText: "Heart icon" }],
]);

const system = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Circulatory system",
  slug: "circulatory",
  shortDescription: "Heart and blood vessels.",
  longDescription: null,
  coverImageUrl: null,
  iconImageUrl: null,
  coverMediaId: "cover-id",
  iconMediaId: "icon-id",
  displayOrder: 3,
  isActive: true,
  status: "PUBLISHED" as const,
  createdAt: updatedAt,
  updatedAt,
};

const topic = {
  id: "20000000-0000-4000-8000-000000000002",
  organSystemId: system.id,
  organSystemName: system.name,
  organSystemSlug: system.slug,
  title: "Heart anatomy",
  slug: "heart-anatomy",
  summary: "The chambers and valves.",
  coverImageUrl: null,
  coverMediaId: "cover-id",
  displayOrder: 4,
  status: "DRAFT" as const,
  createdAt: updatedAt,
  updatedAt,
};

it("renders organ systems as a semantic desktop table and equivalent mobile cards", () => {
  render(<OrganSystemList items={[system]} media={media} page={2} pageSize={12} trashAction={vi.fn()} />);

  const table = screen.getByRole("table", { name: "Organ systems" });
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "S.No", "Preview", "System", "Status / activity", "Order", "Updated", "Actions",
  ]);
  expect(within(table).getByRole("cell", { name: "13" })).toBeInTheDocument();
  expect(screen.getAllByText("circulatory")).toHaveLength(2);
  expect(screen.getAllByText("Published")).toHaveLength(2);
  expect(screen.getAllByText("Active")).toHaveLength(2);
  expect(screen.getAllByRole("img", { name: "Heart cover" })).toHaveLength(2);
  expect(screen.getAllByRole("img", { name: "Heart icon" })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "Edit Circulatory system" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Delete Circulatory system" })).toHaveLength(2);
  expect(table.querySelector("form form")).toBeNull();
});

it("renders topics with their organ system and canonical edit URL", () => {
  render(<TopicList items={[topic]} media={media} page={3} pageSize={15} trashAction={vi.fn()} />);

  const table = screen.getByRole("table", { name: "Topics" });
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "S.No", "Preview", "Topic", "Organ system", "Status", "Order", "Updated", "Actions",
  ]);
  expect(within(table).getByRole("cell", { name: "31" })).toBeInTheDocument();
  expect(screen.getAllByText("Heart anatomy")).toHaveLength(2);
  expect(screen.getAllByText("heart-anatomy")).toHaveLength(2);
  expect(screen.getAllByText("Circulatory system")).toHaveLength(2);
  for (const link of screen.getAllByRole("link", { name: "Edit Heart anatomy" })) {
    expect(link).toHaveAttribute("href", "/organ-systems/circulatory/topics/heart-anatomy");
  }
});

it.each([
  ["organ system", <OrganSystemList items={[system]} key="organ-system" media={media} page={1} pageSize={12} trashAction={vi.fn()} />, "Delete Circulatory system", "Move organ system to Trash?"],
  ["topic", <TopicList items={[topic]} key="topic" media={media} page={1} pageSize={15} trashAction={vi.fn()} />, "Delete Heart anatomy", "Move topic to Trash?"],
])("confirms before moving a %s to recoverable Trash", async (_label, list, deleteName, dialogName) => {
  const user = userEvent.setup();
  const action = vi.fn().mockResolvedValue({ success: "Moved to Trash." });
  const element = list.type === OrganSystemList
    ? <OrganSystemList items={[system]} media={media} page={1} pageSize={12} trashAction={action} />
    : <TopicList items={[topic]} media={media} page={1} pageSize={15} trashAction={action} />;
  render(element);

  await user.click(screen.getAllByRole("button", { name: deleteName })[0]);
  expect(screen.getByRole("alertdialog", { name: dialogName })).toHaveTextContent("restored from Settings > Trash for 30 days");
  expect(action).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Move to Trash" }));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
});
