import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../../src/lib/prisma", () => ({ createPrismaClient: vi.fn() }));
import { createPrismaClient } from "../../../src/lib/prisma";
import { getWorkerRuntime } from "../../../src/config/runtime";
import { getAuthConfig } from "../../../src/config/auth";
import { allowedOrigins, cookieOptions } from "../../../src/middleware/session_http";
import { createWorkerHandler } from "../../../src/worker_handler";
const bindings = {
  HYPERDRIVE: { connectionString: "postgresql://test" },
  JWT_SECRET: "a".repeat(128),
};
it("isola clientes, chaves e origens de requisições concorrentes", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://development-only");
  const clients = [
    { $disconnect: vi.fn().mockResolvedValue(undefined) },
    { $disconnect: vi.fn().mockResolvedValue(undefined) },
  ];
  for (const client of clients)
    vi.mocked(createPrismaClient).mockReturnValueOnce(client as unknown as PrismaClient);
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (p: Promise<unknown>) => pending.push(p) };
  const fetch = createWorkerHandler(async (request) => {
    await new Promise((resolve) => setTimeout(resolve, request.url.includes("first") ? 10 : 1));
    return Response.json({
      origin: getWorkerRuntime()?.origin,
      secret: getAuthConfig().secret,
      origins: allowedOrigins(),
      secure: cookieOptions().secure,
    });
  });
  const responses = await Promise.all([
    fetch(new Request("https://first.example/api/v1/auth/csrf"), bindings, context),
    fetch(
      new Request("https://second.example/api/v1/auth/csrf"),
      { ...bindings, JWT_SECRET: "b".repeat(128) },
      context,
    ),
  ]);
  expect(await responses[0].json()).toEqual({
    origin: "https://first.example",
    secret: bindings.JWT_SECRET,
    origins: ["https://first.example"],
    secure: true,
  });
  expect(await responses[1].json()).toMatchObject({
    origin: "https://second.example",
    secret: "b".repeat(128),
  });
  await Promise.all(pending);
  for (const client of clients) expect(client.$disconnect).toHaveBeenCalledOnce();
  expect(createPrismaClient).toHaveBeenCalledWith(bindings.HYPERDRIVE.connectionString);
  expect(createPrismaClient).not.toHaveBeenCalledWith("postgresql://development-only");
  expect(getWorkerRuntime()).toBeUndefined();
});
describe("falhas de execução do Worker", () => {
  it("falha sem expor detalhes quando o segredo está inválido", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn();
    const response = await createWorkerHandler(handler)(
      new Request("https://hml.example/health"),
      { ...bindings, JWT_SECRET: "fraca" },
      { waitUntil: vi.fn() },
    );
    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });
  it("fecha o cliente mesmo quando o adaptador HTTP falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const close = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createPrismaClient).mockReturnValueOnce({
      $disconnect: close,
    } as unknown as PrismaClient);
    const pending: Promise<unknown>[] = [];
    const response = await createWorkerHandler(async () => {
      throw new Error("detalhe privado");
    })(new Request("https://hml.example/health"), bindings, { waitUntil: (p) => pending.push(p) });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("privado");
    await Promise.all(pending);
    expect(close).toHaveBeenCalledOnce();
  });
});
