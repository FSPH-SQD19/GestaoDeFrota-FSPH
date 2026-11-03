import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({ prisma: { fornecedor: mocks } }));
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/service/auditoria_s", () => ({ registrarAuditoria: vi.fn() }));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-fornecedor", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";

const id = "00000000-0000-4000-8000-000000000001";
const entrada = { razaoSocial: "Oficina", cnpj: "12345678000190", tipoServico: "OFICINA" };
let server: Server;
let base: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/fornecedores`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id, ...entrada });
});
async function chamar(method = "POST", body: unknown = entrada, path = "") {
  const token = signTestToken({ perfis: ["GESTOR"] }, "segredo-sintetico-fornecedor", {
    subject: id,
  });
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("erros de fornecedores no middleware comum", () => {
  it.each([
    [null, "Não foi possível ler os dados enviados. Revise os dados e tente novamente."],
    [{}, "Preencha os campos obrigatórios do fornecedor."],
    [{ ...entrada, razaoSocial: 123 }, "Preencha os campos obrigatórios do fornecedor."],
    [{ ...entrada, cnpj: "123" }, "Confira o CNPJ informado e tente novamente."],
    [{ ...entrada, tipoServico: "OUTRO" }, "Selecione o tipo de serviço do fornecedor."],
  ])("retorna validação padronizada para %j", async (body, message) => {
    expect(await chamar("POST", body)).toEqual({
      status: 400,
      body: { statusCode: 400, message, errors: [] },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("traduz conflito de CNPJ durante a gravação para 409", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicado", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );
    expect(await chamar()).toEqual({
      status: 409,
      body: {
        statusCode: 409,
        message: "Já existe um fornecedor com este CNPJ. Confira o cadastro existente.",
        errors: [],
      },
    });
  });

  it("traduz ausência na atualização para 404", async () => {
    mocks.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Ausente", {
        code: "P2025",
        clientVersion: "6.19.3",
      }),
    );
    expect(await chamar("PATCH", { ativo: false }, `/${id}`)).toEqual({
      status: 404,
      body: {
        statusCode: 404,
        message: "Fornecedor não encontrado. Atualize a lista e tente novamente.",
        errors: [],
      },
    });
  });

  it("encaminha rejeição assíncrona ao middleware, registra uma vez e oculta detalhes", async () => {
    const error = new Error("Credencial privada do banco");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValue(error);
    expect(await chamar()).toEqual({
      status: 500,
      body: {
        statusCode: 500,
        message:
          "O sistema não conseguiu concluir a operação. Tente novamente em alguns instantes.",
        errors: [],
      },
    });
    expect(log).toHaveBeenCalledExactlyOnceWith(error);
  });
});
