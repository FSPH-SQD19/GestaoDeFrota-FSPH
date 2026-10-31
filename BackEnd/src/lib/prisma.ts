import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getWorkerRuntime } from "../config/runtime";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; databaseUrl?: string };
export function createPrismaClient(connectionString: string) {
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
}
export function initializePrisma(connectionString: string): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.databaseUrl !== connectionString)
    throw new Error("O Prisma local já foi inicializado com outra conexão.");
  globalForPrisma.prisma ??= createPrismaClient(connectionString);
  globalForPrisma.databaseUrl = connectionString;
  return globalForPrisma.prisma;
}
// Node reutiliza o pool local. Workers usam exclusivamente o cliente da requisição.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getWorkerRuntime()?.prisma ?? initializePrisma(process.env.DATABASE_URL || "");
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
