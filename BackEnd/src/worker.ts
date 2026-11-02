import { httpServerHandler } from "cloudflare:node";
import { createWorkerHandler } from "./worker_handler";
import { app } from "./app";
app.listen(3000);
const handler = httpServerHandler({ port: 3000 });
export default {
  fetch: createWorkerHandler((request, env, context) => handler.fetch(request, env, context)),
};
