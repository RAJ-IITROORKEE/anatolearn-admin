import { PrismaClient } from "@prisma/client";

import { createCanonicalSeedPlan } from "./seed-data";
import { asSeedStore, installCanonicalSeed } from "./seed-service";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (transaction) => {
    await installCanonicalSeed(asSeedStore(transaction), createCanonicalSeedPlan());
  }, { timeout: 60_000 });

  console.log("Seed completed: canonical systems and draft demonstration content are present.");
}

main()
  .catch(() => {
    console.error("Seed failed without exposing database credentials.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
