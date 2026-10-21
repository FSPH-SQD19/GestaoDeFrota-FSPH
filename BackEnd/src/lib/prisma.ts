import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export let prisma: PrismaClient;
let configuredConnectionString: string | undefined;

export function initializePrisma(connectionString: string): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
  }

  if (prisma) {
    if (configuredConnectionString !== connectionString) {
      throw new Error("O Prisma já foi inicializado com outra conexão.");
    }
    return prisma;
  }

  configuredConnectionString = connectionString;
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5 }),
  });
  return prisma;
}
