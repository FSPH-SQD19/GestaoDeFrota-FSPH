import { httpServerHandler } from "cloudflare:node";
import { createPrismaClient } from "./lib/prisma";
import type { WorkerBindings, WorkerContext } from "./worker_handler";
import { createWorkerHandler } from "./worker_handler";
import { app } from "./app";
app.listen(3000);
const handler = httpServerHandler({ port: 3000 });
export async function limparPosicoesAntigas(env: WorkerBindings) {
  const client = createPrismaClient(env.HYPERDRIVE.connectionString);
  try {
    await client.$executeRaw`DELETE FROM ultimas_posicoes_saida WHERE capturada_em < now() - interval '90 days'`;
    await client.$executeRaw`DELETE FROM posicoes_saida WHERE capturada_em < now() - interval '90 days'`;
  } finally {
    await client.$disconnect();
  }
}
export default {
  scheduled(_event: unknown, env: WorkerBindings, context: WorkerContext) {
    context.waitUntil(limparPosicoesAntigas(env));
  },
  fetch: createWorkerHandler((request, env, context) => handler.fetch(request, env, context)),
};
