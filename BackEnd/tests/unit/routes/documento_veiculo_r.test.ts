import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  veiculoFindUnique: vi.fn(),
  documentoFindMany: vi.fn(),
  documentoFindFirst: vi.fn(),
  documentoCreate: vi.fn(),
  auditoriaCreate: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    veiculo: { findUnique: mocks.veiculoFindUnique },
    documentoVeiculo: {
      findMany: mocks.documentoFindMany,
      findFirst: mocks.documentoFindFirst,
      create: mocks.documentoCreate,
    },
    auditoriaSistema: { create: mocks.auditoriaCreate },
  },
}));

import { app } from "../../../src/app";

const secret = "chave-sintetica-dos-testes-de-documentos";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-0000000000a1";
const caminho = `/api/v1/veiculos/${veiculoId}/documentos`;

type Corpo = {
  statusCode?: number;
  message?: string;
  errors?: Array<{ campo: string; mensagem: string }>;
  [chave: string]: unknown;
};

async function chamar(url: string, { perfis, body }: { perfis?: string[]; body?: unknown } = {}) {
  const temCorpo = body !== undefined;
  const resposta = await fetch(`${baseUrl}${url}`, {
    method: temCorpo ? "POST" : "GET",
    headers: {
      ...(temCorpo && { "content-type": "application/json" }),
      ...(perfis && {
        authorization: `Bearer ${jwt.sign({ perfis }, secret, { subject: usuarioId })}`,
      }),
    },
    body: !temCorpo ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: resposta.status, json: (await resposta.json()) as Corpo };
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: true });
  mocks.documentoFindMany.mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-0000000000d1",
      veiculoId,
      tipoDocumento: "CRLV",
      dataVencimento: new Date("2099-12-31T00:00:00.000Z"),
      status: "VIGENTE",
    },
  ]);
  mocks.documentoFindFirst.mockResolvedValue(null);
  mocks.documentoCreate.mockImplementation(({ data }) =>
    Promise.resolve({ id: "00000000-0000-4000-8000-0000000000d2", ...data }),
  );
  mocks.auditoriaCreate.mockResolvedValue({});
});

describe("GET /api/v1/veiculos/:id/documentos", () => {
  it("exige autenticação", async () => {
    expect((await chamar(caminho)).status).toBe(401);
  });

  it.each(["MOTORISTA", "SOLICITANTE", "SVO"])("retorna 403 para o perfil %s", async (perfil) => {
    expect((await chamar(caminho, { perfis: [perfil] })).status).toBe(403);
    expect(mocks.veiculoFindUnique).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "GESTOR"])("lista com situação e resumo para o perfil %s", async (perfil) => {
    const resposta = await chamar(caminho, { perfis: [perfil] });

    expect(resposta.status).toBe(200);
    expect(resposta.json.data).toEqual([
      expect.objectContaining({
        tipoDocumento: "CRLV",
        dataVencimento: "2099-12-31",
        situacao: "VIGENTE",
        atual: true,
      }),
    ]);
    expect(resposta.json.resumo).toEqual({
      situacaoGeral: "VIGENTE",
      bloqueiaAlocacao: false,
      tiposSemRegistro: ["IPVA", "SEGURO"],
    });
  });

  it("retorna 400 para id inválido", async () => {
    const resposta = await chamar("/api/v1/veiculos/abc/documentos", { perfis: ["GESTOR"] });

    expect(resposta.status).toBe(400);
    expect(resposta.json.errors).toEqual([{ campo: "id", mensagem: "Informe um UUID válido." }]);
  });

  it("retorna 404 para veículo inexistente", async () => {
    mocks.veiculoFindUnique.mockResolvedValue(null);

    const resposta = await chamar(caminho, { perfis: ["GESTOR"] });

    expect(resposta.status).toBe(404);
    expect(resposta.json.message).toBe("Veículo não encontrado.");
  });
});

describe("POST /api/v1/veiculos/:id/documentos", () => {
  const corpo = { tipoDocumento: "SEGURO", dataVencimento: "2099-06-30" };

  it("exige autenticação", async () => {
    expect((await chamar(caminho, { body: corpo })).status).toBe(401);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });

  it("retorna 403 para perfil sem permissão", async () => {
    expect((await chamar(caminho, { perfis: ["SOLICITANTE"], body: corpo })).status).toBe(403);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });

  it("cadastra (201) ignorando campos forjados e audita", async () => {
    const resposta = await chamar(caminho, {
      perfis: ["ADMIN"],
      body: { ...corpo, status: "VIGENTE", veiculoId: "00000000-0000-4000-8000-0000000000ff" },
    });

    expect(resposta.status).toBe(201);
    expect(resposta.json).toMatchObject({
      veiculoId,
      tipoDocumento: "SEGURO",
      dataVencimento: "2099-06-30",
      situacao: "VIGENTE",
      atual: true,
    });
    expect(mocks.documentoCreate).toHaveBeenCalledWith({
      data: {
        veiculoId,
        tipoDocumento: "SEGURO",
        dataVencimento: new Date("2099-06-30T00:00:00.000Z"),
        status: "VIGENTE",
      },
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId,
        acao: "CRIAR",
        tabelaAfetada: "documentos_veiculo",
      }),
    });
  });

  it("retorna 400 com os campos inválidos", async () => {
    const resposta = await chamar(caminho, {
      perfis: ["GESTOR"],
      body: { tipoDocumento: "CNH", dataVencimento: "2099-02-30" },
    });

    expect(resposta.status).toBe(400);
    expect((resposta.json.errors ?? []).map((erro) => erro.campo).sort()).toEqual([
      "dataVencimento",
      "tipoDocumento",
    ]);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON malformado", async () => {
    const resposta = await chamar(caminho, { perfis: ["GESTOR"], body: "{" });

    expect(resposta.status).toBe(400);
    expect(resposta.json.message).toBe("JSON inválido.");
  });

  it("retorna 409 para documento duplicado", async () => {
    mocks.documentoFindFirst.mockResolvedValue({ id: "existente" });

    expect((await chamar(caminho, { perfis: ["GESTOR"], body: corpo })).status).toBe(409);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });

  it("retorna 422 para veículo inativo", async () => {
    mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: false });

    expect((await chamar(caminho, { perfis: ["GESTOR"], body: corpo })).status).toBe(422);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });
});
