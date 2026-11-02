declare module "cloudflare:node" {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
  };
}
