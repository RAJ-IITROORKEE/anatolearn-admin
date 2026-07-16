import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
const template = readFileSync(resolve(process.cwd(), "supabase/templates/confirmation.html"), "utf8");
const emailConfig = config.match(/\[auth\.email\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/)?.[1] ?? "";
const confirmationConfig = config.match(/\[auth\.email\.template\.confirmation\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/)?.[1] ?? "";

describe("signup verification email", () => {
  it("configures a six-digit OTP with a ten-minute lifetime", () => {
    expect(emailConfig).toContain("enable_confirmations = true");
    expect(emailConfig).toContain("otp_length = 6");
    expect(emailConfig).toContain("otp_expiry = 600");
    expect(confirmationConfig).toContain('subject = "Your AnatoLearn verification code"');
    expect(confirmationConfig).toContain('content_path = "./supabase/templates/confirmation.html"');
  });

  it("renders an OTP-only, email-client-safe template", () => {
    expect(template.match(/{{ \.Token }}/g)).toHaveLength(1);
    expect(template).not.toContain(".ConfirmationURL");
    expect(template).not.toContain(".TokenHash");
    expect(template).not.toContain("<script");
    expect(template).not.toMatch(/<a\b|href\s*=|https?:\/\//i);
    expect(template).toContain('<meta name="color-scheme" content="light">');
    expect(template).toContain('role="presentation"');
    expect(template).toContain('aria-label="Your six-digit verification code"');
    expect(template).toContain("This code expires in 10 minutes");
    expect(template).toContain("AnatoLearn Support");
  });
});
