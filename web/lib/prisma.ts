import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connString = process.env.DATABASE_URL;
  if (!connString) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("[Trackio] Creating Prisma client with Neon adapter...");

  // PrismaNeon internally creates a neon.Pool with this config
  const adapter = new PrismaNeon({ connectionString: connString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
