vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: vi.fn().mockResolvedValue({}),
}));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    perfil: { findUnique: vi.fn() },
    usuario: { create: vi.fn() },
    motorista: { create: vi.fn() },
  };

  return {
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    hashPassword: vi.fn(),
    transactionClient,
    transaction: vi.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
    ),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    motorista: { findFirst: mocks.findFirst, findMany: mocks.findMany, update: mocks.update },
  },
}));
vi.mock("../../../src/service/password_s", () => ({
  hashPassword: mocks.hashPassword,
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-motoristas", expiresIn: 28800 }),
}));

import { app } from "../../../src/app";

let server: Server;
let baseUrl: string;
const usuarioId = "00000000-0000-4000-8000-000000000001";
const entrada = {
  nome: "Motorista",
  email: "motorista@example.com",
  senha: "senha123",
  telefone: "(79) 99999-1234",
  cpf: "12345678909",
  numeroCnh: "12345678901",
  categoriaCnh: "B",
  validadeCnh: "2026-10-20",
};

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T02:59:59.999Z"));
  mocks.findFirst.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ id: usuarioId, ativo: false });
  mocks.findMany.mockResolvedValue([]);
  mocks.hashPassword.mockResolvedValue("hash-seguro");
  mocks.transactionClient.perfil.findUnique.mockResolvedValue({ id: "perfil-motorista" });
  mocks.transactionClient.usuario.create.mockResolvedValue({ id: usuarioId });
  mocks.transactionClient.motorista.create.mockResolvedValue({
    id: "motorista-sintetico",
    ...entrada,
  });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.transactionClient));
});
afterEach(() => vi.useRealTimers());

async function cadastrar(body?: unknown, perfis = ["ADMIN"], prefixo = "/motoristas") {
  const token = jwt.sign({ perfis }, "segredo-sintetico-motoristas", {
    subject: usuarioId,
  });
  const response = await fetch(`${baseUrl}${prefixo}`, {
    method: "POST",
    headers: {
      authorization: ["Bearer", token].join(" "),
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("POST /motoristas", () => {
  it.each([
    { caso: "corpo ausente", body: undefined },
    { caso: "objeto vazio", body: {} },
    { caso: "corpo nulo", body: null },
  ])("retorna 400 para $caso sem consultar o banco", async ({ body }) => {
    expect((await cadastrar(body)).status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("exige os dados do usuário e do motorista", async () => {
    expect(await cadastrar({ ...entrada, senha: undefined })).toEqual({
      status: 400,
      body: {
        mensagem: "Informe nome, e-mail, senha, telefone, CPF, CNH, categoria e validade.",
      },
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o e-mail é inválido", async () => {
    const email = "email-inválido";
    expect(await cadastrar({ ...entrada, email })).toMatchObject({
      status: 400,
      body: { mensagem: "E-mail inválido." },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cria a conta e o motorista e retorna 201", async () => {
    const resultado = await cadastrar(entrada);

    expect(resultado.status).toBe(201);
    expect(mocks.hashPassword).toHaveBeenCalledWith("senha123");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.usuario.create).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.motorista.create).toHaveBeenCalledOnce();
  });

  it("restringe o cadastro a gestores e administradores", async () => {
    expect(await cadastrar(entrada, ["MOTORISTA"])).toMatchObject({ status: 403 });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o dia da validade terminou em São Paulo", async () => {
    vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
    expect(await cadastrar(entrada)).toEqual({
      status: 400,
      body: { mensagem: "A CNH está vencida." },
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("compatibilidade e correções do merge de motoristas", () => {
  it("usa a rota canônica /api/v1/motoristas", async () => {
    expect((await cadastrar(entrada, ["GESTOR"], "/api/v1/motoristas")).status).toBe(201);
  });
  it("retorna 409 no conflito detectado antes da transação", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existente" });
    expect(await cadastrar(entrada)).toMatchObject({
      status: 409,
      body: { mensagem: "CPF ou CNH já cadastrado." },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejeita senhas acima do limite de bytes do bcrypt", async () => {
    expect(await cadastrar({ ...entrada, senha: "á".repeat(37) })).toMatchObject({
      status: 400,
      body: { mensagem: "A senha deve ter no máximo 72 bytes." },
    });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });
  it.each(["PATCH", "DELETE"])("preserva %s e a auditoria trazidos pela master", async (method) => {
    const token = jwt.sign({ perfis: ["ADMIN"] }, "segredo-sintetico-motoristas", {
      subject: usuarioId,
    });
    const response = await fetch(`${baseUrl}/api/v1/motoristas/${usuarioId}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(method === "PATCH" ? { body: JSON.stringify({ ativo: false }) } : {}),
    });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: usuarioId }, data: { ativo: false } }),
    );
  });
});
