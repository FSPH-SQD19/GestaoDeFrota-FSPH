import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

const mocks = vi.hoisted(() => {
  const tx = {
    usuario: { create: vi.fn(), update: vi.fn() },
    usuarioPerfil: { deleteMany: vi.fn(), createMany: vi.fn() },
    authSessao: { deleteMany: vi.fn() },
  };
  return {
    tx,
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    perfilFindMany: vi.fn(),
    hashPassword: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    usuario: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
    },
    perfil: { findMany: mocks.perfilFindMany },
  },
}));
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/service/auditoria_s", () => ({ registrarAuditoria: vi.fn() }));
vi.mock("../../../src/service/password_s", () => ({
  hashPassword: mocks.hashPassword,
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-usuarios", expiresIn: 28800 }),
}));

import { app } from "../../../src/app";

const adminId = "00000000-0000-4000-8000-0000000000a1";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const perfilId = "00000000-0000-4000-8000-0000000000b1";
const registro = {
  id: usuarioId,
  nome: "Ana Souza",
  email: "ana@example.test",
  telefone: "(79) 99999-1234",
  setor: "LACEN",
  ativo: true,
  criadoEm: new Date("2026-11-04T12:00:00.000Z"),
  perfis: [{ perfil: { nome: "GESTOR" } }],
};
const entrada = {
  nome: "Ana Souza",
  email: "ana@example.test",
  senha: "senha-segura",
  telefone: "79999991234",
  setor: "LACEN",
  perfis: ["GESTOR"],
};

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/usuarios`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("hash-seguro");
  mocks.perfilFindMany.mockResolvedValue([{ id: perfilId, nome: "GESTOR" }]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.findFirst.mockResolvedValue(null);
  mocks.findMany.mockResolvedValue([registro]);
  mocks.count.mockResolvedValue(1);
  mocks.create.mockResolvedValue(registro);
  mocks.tx.usuario.update.mockResolvedValue({ ...registro, ativo: false });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
});

async function chamar(
  method = "GET",
  path = "",
  body?: unknown,
  perfis: string[] | null = ["ADMIN"],
  subject = adminId,
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (perfis) {
    headers.authorization = `Bearer ${signTestToken({ perfis }, "segredo-sintetico-usuarios", {
      subject,
    })}`;
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

describe("autorização de /api/v1/usuarios", () => {
  it("exige autenticação", async () => {
    expect(await chamar("GET", "", undefined, null)).toMatchObject({
      status: 401,
      body: { statusCode: 401 },
    });
  });

  it("restringe a ADMIN", async () => {
    expect(await chamar("GET", "", undefined, ["GESTOR"])).toMatchObject({
      status: 403,
      body: { statusCode: 403 },
    });
  });
});

describe("CRUD de usuários", () => {
  it("lista com paginação", async () => {
    const resposta = await chamar("GET", "?page=1&pageSize=20&busca=Ana");
    expect(resposta).toMatchObject({
      status: 200,
      body: {
        data: [
          expect.objectContaining({
            id: usuarioId,
            email: "ana@example.test",
            perfis: ["GESTOR"],
          }),
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    });
  });

  it("obtém por id", async () => {
    mocks.findUnique.mockResolvedValue(registro);
    const resposta = await chamar("GET", `/${usuarioId}`);
    expect(resposta).toMatchObject({
      status: 200,
      body: { id: usuarioId, perfis: ["GESTOR"] },
    });
  });

  it("cadastra usuário e devolve Location", async () => {
    const resposta = await chamar("POST", "", entrada);
    expect(resposta.status).toBe(201);
    expect(resposta.headers.get("location")).toBe(`/api/v1/usuarios/${usuarioId}`);
    expect(resposta.body).toMatchObject({
      mensagem: "Usuário cadastrado com sucesso.",
      dados: { id: usuarioId, email: "ana@example.test", telefone: "(79) 99999-1234" },
    });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("valida campos obrigatórios no cadastro", async () => {
    expect(await chamar("POST", "", {})).toMatchObject({
      status: 400,
      body: { statusCode: 400 },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("traduz e-mail duplicado para 409", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicado", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );
    expect(await chamar("POST", "", entrada)).toMatchObject({
      status: 409,
      body: {
        statusCode: 409,
        message: "Já existe um usuário com este e-mail. Confira o cadastro existente.",
      },
    });
  });

  it("atualiza usuário", async () => {
    mocks.findUnique.mockResolvedValue({
      id: usuarioId,
      ativo: true,
      perfis: [{ perfil: { nome: "GESTOR" } }],
    });
    mocks.tx.usuario.update.mockResolvedValue({
      ...registro,
      nome: "Ana Atualizada",
    });

    expect(await chamar("PATCH", `/${usuarioId}`, { nome: "Ana Atualizada" })).toMatchObject({
      status: 200,
      body: {
        mensagem: "Usuário atualizado com sucesso.",
        dados: { nome: "Ana Atualizada" },
      },
    });
  });

  it("inativa usuário e revoga sessões", async () => {
    mocks.findUnique.mockResolvedValue({ id: usuarioId, ativo: true });

    expect(await chamar("DELETE", `/${usuarioId}`)).toMatchObject({
      status: 200,
      body: {
        mensagem: "Usuário inativado com sucesso.",
        dados: { id: usuarioId, ativo: false },
      },
    });
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
  });

  it("impede inativar a própria conta", async () => {
    expect(await chamar("DELETE", `/${adminId}`, undefined, ["ADMIN"], adminId)).toMatchObject({
      status: 400,
      body: {
        statusCode: 400,
        message: "Você não pode inativar a própria conta.",
      },
    });
  });

  it("retorna 404 para usuário inexistente", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await chamar("GET", `/${usuarioId}`)).toMatchObject({
      status: 404,
      body: { statusCode: 404 },
    });
  });

  it("rejeita telefone inválido no cadastro", async () => {
    expect(await chamar("POST", "", { ...entrada, telefone: "123" })).toMatchObject({
      status: 400,
      body: {
        statusCode: 400,
        message: "Telefone deve conter DDD e 8 ou 9 dígitos.",
      },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejeita PATCH sem campos", async () => {
    expect(await chamar("PATCH", `/${usuarioId}`, {})).toMatchObject({
      status: 400,
      body: { statusCode: 400 },
    });
  });

  it.each(["POST", "PATCH"])("rejeita telefone sem dígitos no %s sem gravar", async (method) => {
    if (method === "PATCH") mocks.findUnique.mockResolvedValue(registro);
    const resposta = await chamar(
      method,
      method === "PATCH" ? `/${usuarioId}` : "",
      method === "PATCH" ? { telefone: "abc" } : { ...entrada, telefone: "abc" },
    );
    expect(resposta).toMatchObject({
      status: 400,
      body: {
        errors: [{ campo: "telefone", mensagem: "Telefone deve conter DDD e 8 ou 9 dígitos." }],
      },
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("revoga sessões mesmo quando o PATCH repete uma inativação", async () => {
    mocks.findUnique.mockResolvedValue({ ...registro, ativo: false });
    expect(await chamar("PATCH", `/${usuarioId}`, { ativo: false })).toMatchObject({
      status: 200,
      body: { dados: { ativo: false } },
    });
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
  });

  it("filtra listagem por setor, perfil e ativo", async () => {
    await chamar("GET", "?setor=LACEN&perfil=GESTOR&ativo=true&page=2&pageSize=10");
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ativo: true,
          setor: { equals: "LACEN", mode: "insensitive" },
          perfis: { some: { perfil: { nome: "GESTOR" } } },
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it.each([["MOTORISTA"], ["SVO"], ["SOLICITANTE"], ["GESTOR"]])(
    "nega acesso a perfil %s",
    async (perfil) => {
      expect(await chamar("POST", "", entrada, [perfil])).toMatchObject({
        status: 403,
        body: { statusCode: 403 },
      });
    },
  );
});
