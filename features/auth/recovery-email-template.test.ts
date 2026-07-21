import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
const template = readFileSync(resolve(process.cwd(), "supabase/templates/recovery.html"), "utf8");

describe("password recovery email", () => {
  it("configures a dedicated recovery template with OTP and link compatibility", () => {
    expect(config).toMatch(/\[auth\.email\.template\.recovery\][\s\S]*content_path = "\.\/supabase\/templates\/recovery\.html"/);
    expect(template.match(/{{ \.Token }}/g)).toHaveLength(1);
    expect(template.match(/{{ \.ConfirmationURL }}/g)).toHaveLength(1);
    expect(template).not.toContain("<script");
    expect(template).toContain('aria-label="Your six-digit password recovery code"');
  });
});
