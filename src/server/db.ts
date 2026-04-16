import { Prisma, PrismaClient } from "@/src/generated/prisma/index";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type DbClient = PrismaClient | Prisma.TransactionClient;
