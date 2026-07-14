import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = describe.skipIf(!testDatabaseUrl);
const directClientRoles = ["anon", "authenticated"] as const;
const unexpectedWriteMarker = "DIRECT_DATABASE_WRITE_UNEXPECTEDLY_ALLOWED";

integrationDescribe("direct PostgreSQL application-table access", () => {
  let client: PrismaClient;
  let applicationSchema: string;

  beforeAll(async () => {
    client = new PrismaClient({ datasourceUrl: testDatabaseUrl! });
    const schemas = await client.$queryRaw<Array<{ currentSchema: string | null }>>(Prisma.sql`
      SELECT current_schema() AS "currentSchema"
    `);
    applicationSchema = schemas[0]?.currentSchema ?? "";
    expect(applicationSchema).not.toBe("");
    expect(["auth", "storage"]).not.toContain(applicationSchema);

    for (const role of directClientRoles) {
      const currentRoles = await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        return tx.$queryRaw<Array<{
          currentRole: string;
          currentSchema: string | null;
          sessionRole: string;
        }>>(Prisma.sql`
          SELECT
            current_user AS "currentRole",
            current_schema() AS "currentSchema",
            session_user AS "sessionRole"
        `);
      });

      expect(currentRoles[0]?.currentRole).toBe(role);
      expect(currentRoles[0]?.currentSchema).toBe(applicationSchema);
      expect(currentRoles[0]?.sessionRole).not.toBe(role);
    }
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it.each(directClientRoles)("denies %s reads from application tables", async (role) => {
    await expect(client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$queryRaw(Prisma.sql`SELECT count(*) FROM "Profile"`);
    })).rejects.toThrow(/permission denied|row-level security/i);
  });

  it.each(directClientRoles)("denies %s writes to application tables", async (role) => {
    await expect(client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "Profile" (
          "id", "fullName", "email", "emailNormalized", "updatedAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid,
          'Denied direct client',
          'denied@example.test',
          'denied@example.test',
          CURRENT_TIMESTAMP
        )
      `);
      throw new Error(unexpectedWriteMarker);
    })).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("keeps the default Prisma database role operational", async () => {
    await expect(client.profile.count()).resolves.toEqual(expect.any(Number));
  });
});
