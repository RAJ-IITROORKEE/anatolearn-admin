import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deployment contract", () => {
  it("regenerates Prisma Client before the Vercel production build", () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as { buildCommand?: string };

    expect(vercelConfig.buildCommand).toBe("npm run prisma:generate && npm run build");
  });
});
