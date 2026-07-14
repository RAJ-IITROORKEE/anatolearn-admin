import { expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "font-inter" }) }));

import { metadata } from "./layout";
import robots from "./robots";

it("keeps the private admin application out of search indexes", () => {
  expect(metadata.robots).toEqual({ follow: false, index: false });
  expect(robots()).toEqual({ rules: { allow: [], disallow: "/", userAgent: "*" } });
});
