import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

it("toggles password visibility without replacing the field or losing its value", async () => {
  const user = userEvent.setup();
  render(<AuthForm action={vi.fn()} fields={[{ name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} submitLabel="Sign in" />);

  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveAttribute("autocomplete", "current-password");
  await user.type(password, "stable secret");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("stable secret");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
});
