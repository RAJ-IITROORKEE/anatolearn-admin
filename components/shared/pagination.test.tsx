import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let query = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => query,
}));

import { Pagination } from "./pagination";

describe("Pagination", () => {
  beforeEach(() => {
    query = new URLSearchParams("q=heart&status=DRAFT&page=2&topicId=topic-id");
  });

  it("preserves current query parameters while changing only page", () => {
    render(<Pagination page={2} pageCount={4} pathname="/content" />);

    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/content?q=heart&status=DRAFT&page=1&topicId=topic-id");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/content?q=heart&status=DRAFT&page=3&topicId=topic-id");
  });
});
