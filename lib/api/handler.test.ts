import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapApiError } from "./handler";

describe("API error mapping", () => {
  it("maps the dedicated restore-deadline SQLSTATE to a safe conflict", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("database trigger rejected update", {
      code: "P2010",
      clientVersion: "test",
      meta: { code: "PZ001", message: "Trash retention deadline has expired" },
    });

    const response = mapApiError(error, crypto.randomUUID());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RESTORE_EXPIRED", message: "The trash retention deadline has expired." },
    });
  });
});
