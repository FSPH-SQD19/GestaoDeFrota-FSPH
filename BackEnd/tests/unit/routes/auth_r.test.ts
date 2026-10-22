import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  comparePassword: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: mocks.findUnique },
    veiculo: { findMany: mocks.findMany, count: mocks.count },
  },
}));
vi.mock("../../../src/service/password_s", () => ({ comparePassword: mocks.comparePassword }));

import { app } from "../../../src/app";

const secret = "segredo-sintetico-rotas-auth";
const usuario = {
  id: "usuario-sintetico",
  nome: "Teste",
  email: "teste@example.test",
  ativo: true,
  senhaHash: "hash-sintetico",
  perfis: [{ perfil: { nome: "ADMIN" } }],
};
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });

  mocks.findUnique.mockResolvedValue(usuario);
  mocks.comparePassword.mockResolvedValue(true);
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
});

function token(perfis: string[], options: jwt.SignOptions = {}) {
  return jwt.sign({ perfis }, secret, { subject: usuario.id, ...options });
}

async function consultar(path: string, authorization?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authorization ? { authorization } : {},
  });
  return { status: response.status, body: await response.json() };
}

describe.each(["/auth", "/api/v1/auth"])("rotas %s", (prefix) => {
  describe.each(["/perfil", "/admin"])("GET %s", (endpoint) => {
    it.each([
      { caso: "sem autenticação", header: undefined, message: "Autenticação necessária." },
      {
        caso: "token inválido",
        header: "Bearer abc.def.ghi",
        message: "Token inválido ou expirado.",
      },
      {
        caso: "assinatura inválida",
        header: `Bearer ${jwt.sign({ perfis: ["ADMIN"] }, "outra-chave", { subject: usuario.id })}`,
        message: "Token inválido ou expirado.",
      },
      {
        caso: "token expirado",
        header: `Bearer ${token(["ADMIN"], { expiresIn: -1 })}`,
        message: "Token inválido ou expirado.",
      },
    ])("retorna 401 padronizado para $caso", async ({ header, message }) => {
      expect(await consultar(`${prefix}${endpoint}`, header)).toEqual({
        status: 401,
        body: { statusCode: 401, message, errors: [] },
      });
      expect(mocks.findUnique).not.toHaveBeenCalled();
    });
  });

  it("retorna o perfil autenticado preservando o formato público", async () => {
    expect(await consultar(`${prefix}/perfil`, `Bearer ${token(["MOTORISTA"])}`)).toEqual({
      status: 200,
      body: { usuario: { userId: usuario.id, perfis: ["MOTORISTA"] } },
    });
  });

  it("formata falha de configuração pelo handler comum", async () => {
    vi.mocked(getAuthConfig).mockImplementation(() => {
      throw new Error("Arquivo de chave indisponível");
    });
    expect(await consultar(`${prefix}/perfil`, `Bearer ${token(["ADMIN"])}`)).toEqual({
      status: 500,
      body: { statusCode: 500, message: "Configuração de autenticação inválida.", errors: [] },
    });
  });

  it.each(["GESTOR", "MOTORISTA"])("nega acesso administrativo ao perfil %s", async (perfil) => {
    expect(await consultar(`${prefix}/admin`, `Bearer ${token([perfil])}`)).toEqual({
      status: 403,
      body: {
        statusCode: 403,
        message: "Você não tem permissão para realizar esta operação.",
        errors: [],
      },
    });
  });

  it("autoriza ADMIN mesmo entre múltiplos perfis", async () => {
    expect(await consultar(`${prefix}/admin`, `Bearer ${token(["MOTORISTA", "ADMIN"])}`)).toEqual({
      status: 200,
      body: { mensagem: "Acesso autorizado." },
    });
  });

  it("aceita o JWT emitido pelo login em perfil, admin e veículos", async () => {
    // Duração fixa de oito horas, sem configuração por ambiente.
    const response = await fetch(`${baseUrl}${prefix}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: usuario.email, senha: "senha-sintetica" }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { token: string };
    const payload = jwt.verify(result.token, secret) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(28800);
    const header = `Bearer ${result.token}`;
    expect((await consultar(`${prefix}/perfil`, header)).body).toEqual({
      usuario: { userId: usuario.id, perfis: ["ADMIN"] },
    });
    expect((await consultar(`${prefix}/admin`, header)).status).toBe(200);
    expect((await consultar("/api/v1/veiculos", header)).status).toBe(200);
  });
});
