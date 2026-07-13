import { render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState", () => {
  it("presents one useful next action", () => {
    render(
      <EmptyState
        icon={Plus}
        title="No organ systems yet"
        description="Create the first organ system to begin organizing content."
        action={{ href: "/organ-systems/new", label: "Add organ system" }}
      />,
    );

    expect(screen.getByRole("heading", { name: "No organ systems yet" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add organ system" })).toHaveAttribute(
      "href",
      "/organ-systems/new",
    );
  });
});
