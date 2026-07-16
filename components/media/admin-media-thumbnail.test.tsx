import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminMediaThumbnail } from "./admin-media-thumbnail";

describe("AdminMediaThumbnail", () => {
  it("renders signed managed media with its stored alt text", () => {
    render(<AdminMediaThumbnail label="Cover" media={{ id: "media", signedUrl: "https://example.com/signed", width: 100, height: 80, altText: "Heart cover" }} />);
    expect(screen.getByRole("img", { name: "Heart cover" })).toHaveAttribute("src", "https://example.com/signed");
    expect(screen.getByText("Cover attached")).toBeInTheDocument();
  });

  it("distinguishes signing failure from no attached image", () => {
    const { rerender } = render(<AdminMediaThumbnail attached label="Icon" />);
    expect(screen.getByText("Icon preview unavailable")).toBeInTheDocument();
    rerender(<AdminMediaThumbnail label="Icon" />);
    expect(screen.getByText("No icon")).toBeInTheDocument();
  });

  it("uses a legacy URL when no managed asset is attached", () => {
    render(<AdminMediaThumbnail label="Cover" legacyUrl="https://example.com/legacy.png" />);
    expect(screen.getByRole("img", { name: "Cover" })).toHaveAttribute("src", "https://example.com/legacy.png");
  });
});
