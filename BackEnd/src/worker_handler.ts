import { validateAuthSecret } from "./config/auth";
import { withWorkerRuntime } from "./config/runtime";
import { createPrismaClient } from "./lib/prisma";
export interface WorkerBindings {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
  APP_ORIGINS?: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;
}
export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
export function createWorkerHandler(
  handler: (request: Request, env: WorkerBindings, context: WorkerContext) => Promise<Response>,
) {
  return async function fetch(
    request: Request,
    env: WorkerBindings,
    context: WorkerContext,
  ): Promise<Response> {
    try {
      validateAuthSecret(env.JWT_SECRET);
      const client = createPrismaClient(env.HYPERDRIVE.connectionString);
      return await withWorkerRuntime(
        {
          prisma: client,
          secret: env.JWT_SECRET,
          origin: new URL(request.url).origin,
          clientIp: request.headers.get("CF-Connecting-IP") || "unknown",
          appOrigins: env.APP_ORIGINS,
          issuer: env.JWT_ISSUER || "fsph-frota-api-hml",
          audience: env.JWT_AUDIENCE || "fsph-frota-web-hml",
        },
        async () => {
          try {
            return await handler(request, env, context);
          } finally {
            context.waitUntil(
              client.$disconnect().catch(() => {
                console.error("Falha ao encerrar conexão da requisição.");
              }),
            );
          }
        },
      );
    } catch {
      console.error("Falha de configuração ou execução do Worker.");
      return Response.json(
        { message: "Serviço temporariamente indisponível." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
