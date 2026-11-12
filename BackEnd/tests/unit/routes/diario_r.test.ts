import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

vi.mock("../../../src/lib/prisma", () => ({ prisma: {} }));
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-diario", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";

let server: Server;
let base: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/motorista`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

async function chamar(path: string, body?: unknown, perfis = ["MOTORISTA"]) {
  const token = signTestToken({ perfis }, "segredo-sintetico-diario", {
    subject: "00000000-0000-4000-8000-000000000001",
  });
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("diário integrado ao padrão de erros da API", () => {
  it("expõe a configuração autenticada mesmo com o módulo desativado", async () => {
    expect(await chamar("/config")).toEqual({ status: 200, body: { enabled: false } });
  });
  it("retorna 404 padronizado quando o módulo está desativado", async () => {
    expect(await chamar("/tarefas")).toEqual({
      status: 404,
      body: { statusCode: 404, message: "Módulo do motorista não habilitado.", errors: [] },
    });
  });
  it("retorna campos inválidos em português antes de iniciar a saída", async () => {
    vi.stubEnv("DRIVER_PWA_ENABLED", "true");
    const result = await chamar("/saidas", {});
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      statusCode: 400,
      message: "Revise os campos indicados e tente novamente.",
      errors: expect.arrayContaining([
        {
          campo: "kmInicial",
          mensagem: "Confira os dados informados neste campo e tente novamente.",
        },
      ]),
    });
  });
  it("valida o identificador da saída com o helper compartilhado", async () => {
    vi.stubEnv("DRIVER_PWA_ENABLED", "true");
    const result = await chamar("/saidas/invalido");
    expect(result.status).toBe(400);
    expect(result.body.errors).toHaveLength(1);
    expect(result.body.message).toBe("Revise os campos indicados e tente novamente.");
  });
  it("preserva a autorização de motorista com o módulo ativo", async () => {
    vi.stubEnv("DRIVER_PWA_ENABLED", "true");
    const result = await chamar("/tarefas", undefined, ["GESTOR"]);
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ statusCode: 403, errors: [] });
  });
});
