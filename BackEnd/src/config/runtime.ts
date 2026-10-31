import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type WorkerRuntime = {
  prisma: PrismaClient;
  secret: string;
  origin: string;
  clientIp: string;
  appOrigins?: string;
  issuer: string;
  audience: string;
};
const requests = new AsyncLocalStorage<WorkerRuntime>();
export const getWorkerRuntime = () => requests.getStore();
export function withWorkerRuntime<T>(runtime: WorkerRuntime, callback: () => T): T {
  return requests.run(runtime, callback);
}
