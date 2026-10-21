import { httpServerHandler } from "cloudflare:node";
import { configureAuthConfig } from "./config/auth";
import { initializePrisma } from "./lib/prisma";
import { app } from "./app";

interface WorkerBindings {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
}

app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export default {
  fetch(request: Request, env: WorkerBindings, context: unknown): Promise<Response> {
    configureAuthConfig(env.JWT_SECRET);
    initializePrisma(env.HYPERDRIVE.connectionString);
    return expressHandler.fetch(request, env, context);
  },
};
