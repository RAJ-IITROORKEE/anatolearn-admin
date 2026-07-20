import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/app/(admin)/phase6-actions", () => ({ changeUserActivityAction: vi.fn() }));

import { UserList } from "./user-list";

it("renders learner data as a semantic table with a mobile card equivalent", () => {
  render(<UserList users={[{ id: crypto.randomUUID(), fullName: "Ada Learner", email: "ada@example.com", avatarUrl: "https://signed.example/avatar", isActive: true, createdAt: new Date("2026-07-01Z"), lastLoginAt: null }]} />);
  expect(screen.getByRole("table", { name: "Learner accounts" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Ada Learner" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  expect(screen.getAllByRole("img", { name: "Ada Learner's avatar" })).toHaveLength(2);
});
