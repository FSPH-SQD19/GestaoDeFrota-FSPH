import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Prisma } from "@prisma/client";
import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  veiculoFindUnique: vi.fn(),
  queryRaw: vi.fn(),
  veiculoUpdate: vi.fn(),
  usuarioFindMany: vi.fn(),
  notificacaoCreateMany: vi.fn(),
  motoristaFindUnique: vi.fn(),
  fornecedorFindUnique: vi.fn(),
  abastecimentoFindFirst: vi.fn(),
  abastecimentoFindMany: vi.fn(),
  abastecimentoCount: vi.fn(),
  abastecimentoCreate: vi.fn(),
  solicitacaoFindMany: vi.fn(),
  ordemFindMany: vi.fn(),
  auditoriaCreate: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => {
  const cliente: Record<string, unknown> = {
    $queryRaw: mocks.queryRaw,
    veiculo: { findUnique: mocks.veiculoFindUnique, update: mocks.veiculoUpdate },
    usuario: { findMany: mocks.usuarioFindMany },
    notificacao: { createMany: mocks.notificacaoCreateMany },
    motorista: { findUnique: mocks.motoristaFindUnique },
    fornecedor: { findUnique: mocks.fornecedorFindUnique },
    abastecimento: {
      findFirst: mocks.abastecimentoFindFirst,
      findMany: mocks.abastecimentoFindMany,
      count: mocks.abastecimentoCount,
      create: mocks.abastecimentoCreate,
    },
    solicitacaoViagem: { findMany: mocks.solicitacaoFindMany },
    ordemColetaSvo: { findMany: mocks.ordemFindMany },
    auditoriaSistema: { create: mocks.auditoriaCreate },
  };
  cliente.$transaction = (operacao: (tx: unknown) => unknown) => operacao(cliente);
  return { prisma: cliente };
});

import { app } from "../../../src/app";

const secret = "chave-sintetica-dos-testes-de-abastecimento";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const motoristaId = "00000000-0000-4000-8000-0000000000b1";
const outroMotoristaId = "00000000-0000-4000-8000-0000000000b2";
const veiculoId = "00000000-0000-4000-8000-0000000000a1";
const outroVeiculoId = "00000000-0000-4000-8000-0000000000a2";
const caminho = "/api/v1/abastecimentos";

type Corpo = {
  message?: string;
  errors?: Array<{ campo: string; mensagem: string }>;
  data?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  [chave: string]: unknown;
};

async function chamar(
  metodo: string,
  url: string,
  { perfis, body }: { perfis?: string[]; body?: unknown } = {},
) {
  const resposta = await fetch(`${baseUrl}${url}`, {
    method: metodo,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(perfis && {
        authorization: `Bearer ${signTestToken({ perfis }, secret, { subject: usuarioId })}`,
      }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: resposta.status, json: (await resposta.json()) as Corpo };
}

const corpoValido = (extra: Record<string, unknown> = {}) => ({
  odometro: 1500,
  litros: 40,
  valorTotal: 250.5,
  postoCredenciado: "  Posto Prime Centro  ",
  ...extra,
});

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
  vi.clearAllMocks();
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.queryRaw.mockResolvedValue([]);
  mocks.veiculoUpdate.mockResolvedValue({});
  mocks.usuarioFindMany.mockResolvedValue([{ id: usuarioId }]);
  mocks.notificacaoCreateMany.mockResolvedValue({ count: 1 });
  mocks.veiculoFindUnique.mockResolvedValue({
    id: veiculoId,
    placa: "ABC1234",
    ativo: true,
    odometroAtual: new Prisma.Decimal(1000),
    kmProximaRevisao: null,
  });
  mocks.motoristaFindUnique.mockImplementation(async ({ where }) =>
    where.usuarioId ? { id: motoristaId, ativo: true } : { ativo: true },
  );
  mocks.fornecedorFindUnique.mockResolvedValue({ ativo: true });
  mocks.abastecimentoFindFirst.mockResolvedValue(null);
  mocks.abastecimentoFindMany.mockResolvedValue([]);
  mocks.abastecimentoCount.mockResolvedValue(0);
  mocks.abastecimentoCreate.mockImplementation(async ({ data }) => ({
    id: "00000000-0000-4000-8000-0000000000f1",
    motoristaId: null,
    fornecedorId: null,
    postoCredenciado: null,
    ...data,
    odometro: new Prisma.Decimal(data.odometro),
    litros: new Prisma.Decimal(data.litros),
    valorTotal: new Prisma.Decimal(data.valorTotal),
  }));
  mocks.solicitacaoFindMany.mockResolvedValue([{ veiculoAlocadoId: veiculoId }]);
  mocks.ordemFindMany.mockResolvedValue([]);
  mocks.auditoriaCreate.mockResolvedValue({});
});

describe("postoCredenciado", () => {
  it("salva o posto aparado e devolve no lançamento e na auditoria", async () => {
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["GESTOR"],
      body: corpoValido({ veiculoId }),
    });
    expect(status).toBe(201);
    expect(json.postoCredenciado).toBe("Posto Prime Centro");
    expect(mocks.abastecimentoCreate.mock.calls[0]![0].data.postoCredenciado).toBe(
      "Posto Prime Centro",
    );
    expect(mocks.auditoriaCreate.mock.calls[0]![0].data.dadosNovos.postoCredenciado).toBe(
      "Posto Prime Centro",
    );
  });

  it.each([undefined, null, "", "   "])("é opcional (%j vira nulo)", async (posto) => {
    const { status } = await chamar("POST", caminho, {
      perfis: ["ADMIN"],
      body: corpoValido({ veiculoId, postoCredenciado: posto }),
    });
    expect(status).toBe(201);
    expect(mocks.abastecimentoCreate.mock.calls[0]![0].data.postoCredenciado).toBeUndefined();
  });

  it("recusa posto acima de 150 caracteres ou que não seja texto", async () => {
    for (const posto of ["x".repeat(151), 123]) {
      const { status, json } = await chamar("POST", caminho, {
        perfis: ["GESTOR"],
        body: corpoValido({ veiculoId, postoCredenciado: posto }),
      });
      expect(status).toBe(400);
      expect(json.errors?.[0]?.campo).toBe("postoCredenciado");
    }
    expect(mocks.abastecimentoCreate).not.toHaveBeenCalled();
  });

  it("aparece na listagem do gestor", async () => {
    mocks.abastecimentoFindMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-0000000000f1",
        veiculoId,
        motoristaId,
        fornecedorId: null,
        dataHora: new Date("2026-11-09T12:00:00Z"),
        odometro: null,
        litros: new Prisma.Decimal(40),
        valorTotal: new Prisma.Decimal(250),
        postoCredenciado: "Posto Prime Centro",
      },
    ]);
    mocks.abastecimentoCount.mockResolvedValue(1);
    const { status, json } = await chamar("GET", caminho, { perfis: ["GESTOR"] });
    expect(status).toBe(200);
    expect(json.data?.[0]?.postoCredenciado).toBe("Posto Prime Centro");
  });
});

describe("POST pelo MOTORISTA", () => {
  it("ignora motoristaId e dataHora do corpo e usa o veículo em execução", async () => {
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido({
        motoristaId: outroMotoristaId,
        dataHora: "2020-01-01T00:00:00Z",
      }),
    });
    expect(status).toBe(201);
    expect(json.motoristaId).toBe(motoristaId);
    const data = mocks.abastecimentoCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ motoristaId, veiculoId, postoCredenciado: "Posto Prime Centro" });
    expect(data.dataHora.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(mocks.motoristaFindUnique).toHaveBeenCalledWith({
      where: { usuarioId },
      select: { id: true, ativo: true },
    });
    expect(mocks.solicitacaoFindMany).toHaveBeenCalledWith({
      where: { motoristaAlocadoId: motoristaId, status: "EM_TRANSITO" },
      select: { veiculoAlocadoId: true },
    });
    expect(mocks.ordemFindMany).toHaveBeenCalledWith({
      where: {
        motoristaId,
        status: { in: ["EM_ANDAMENTO", "EM_DESLOCAMENTO", "NO_LOCAL"] },
      },
      select: { veiculoId: true },
    });
  });

  it("aceita a viatura de coleta SVO em andamento informada", async () => {
    mocks.solicitacaoFindMany.mockResolvedValue([]);
    mocks.ordemFindMany.mockResolvedValue([{ veiculoId: outroVeiculoId }]);
    const { status } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido({ veiculoId: outroVeiculoId }),
    });
    expect(status).toBe(201);
    expect(mocks.abastecimentoCreate.mock.calls[0]![0].data.veiculoId).toBe(outroVeiculoId);
  });

  it("recusa veículo que não está em execução com ele", async () => {
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido({ veiculoId: outroVeiculoId }),
    });
    expect(status).toBe(422);
    expect(json.errors?.[0]?.campo).toBe("veiculoId");
    expect(mocks.abastecimentoCreate).not.toHaveBeenCalled();
  });

  it("recusa quando não há viagem nem coleta em andamento", async () => {
    mocks.solicitacaoFindMany.mockResolvedValue([]);
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido(),
    });
    expect(status).toBe(422);
    expect(json.message).toBe("Você não tem viagem ou coleta em andamento.");
  });

  it("pede o veículo quando há mais de um em execução", async () => {
    mocks.ordemFindMany.mockResolvedValue([{ veiculoId: outroVeiculoId }]);
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido(),
    });
    expect(status).toBe(422);
    expect(json.message).toBe("Selecione o veículo abastecido.");
  });

  it("conta o mesmo veículo uma vez só", async () => {
    mocks.ordemFindMany.mockResolvedValue([{ veiculoId }]);
    const { status } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido(),
    });
    expect(status).toBe(201);
  });

  it.each([null, { id: motoristaId, ativo: false }])(
    "403 sem motorista ativo vinculado ao usuário (%j)",
    async (motorista) => {
      mocks.motoristaFindUnique.mockResolvedValue(motorista);
      const { status } = await chamar("POST", caminho, {
        perfis: ["MOTORISTA"],
        body: corpoValido(),
      });
      expect(status).toBe(403);
      expect(mocks.abastecimentoCreate).not.toHaveBeenCalled();
    },
  );

  it("mantém as validações de odômetro do cadastro", async () => {
    mocks.abastecimentoFindFirst.mockResolvedValueOnce({ odometro: new Prisma.Decimal(2000) });
    const { status, json } = await chamar("POST", caminho, {
      perfis: ["MOTORISTA"],
      body: corpoValido(),
    });
    expect(status).toBe(422);
    expect(json.errors?.[0]?.campo).toBe("odometro");
  });

  it("ADMIN que também é MOTORISTA segue o fluxo da gestão", async () => {
    const { status } = await chamar("POST", caminho, {
      perfis: ["ADMIN", "MOTORISTA"],
      body: corpoValido({ veiculoId: outroVeiculoId }),
    });
    expect(status).toBe(201);
    expect(mocks.solicitacaoFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /meus", () => {
  it("lista só os lançamentos do motorista logado, ignorando motoristaId da query", async () => {
    const { status, json } = await chamar(
      "GET",
      `${caminho}/meus?motoristaId=${outroMotoristaId}&page=2&pageSize=5`,
      { perfis: ["MOTORISTA"] },
    );
    expect(status).toBe(200);
    expect(json.meta).toMatchObject({ page: 2, pageSize: 5, total: 0 });
    const consulta = mocks.abastecimentoFindMany.mock.calls[0]![0];
    expect(consulta.where.motoristaId).toBe(motoristaId);
    expect(consulta).toMatchObject({ skip: 5, take: 5 });
    expect(mocks.abastecimentoCount.mock.calls[0]![0].where.motoristaId).toBe(motoristaId);
  });

  it("403 sem motorista vinculado", async () => {
    mocks.motoristaFindUnique.mockResolvedValue(null);
    const { status } = await chamar("GET", `${caminho}/meus`, { perfis: ["MOTORISTA"] });
    expect(status).toBe(403);
  });

  it("gestor filtra a listagem geral por motoristaId", async () => {
    const { status } = await chamar("GET", `${caminho}?motoristaId=${motoristaId}`, {
      perfis: ["GESTOR"],
    });
    expect(status).toBe(200);
    expect(mocks.abastecimentoFindMany.mock.calls[0]![0].where.motoristaId).toBe(motoristaId);
  });
});

describe("perfis", () => {
  it.each([
    ["GET", caminho, ["MOTORISTA"], 403],
    ["GET", caminho, ["SVO"], 403],
    ["GET", `${caminho}/meus`, ["GESTOR"], 403],
    ["GET", `${caminho}/meus`, ["ADMIN"], 403],
    ["POST", caminho, ["SOLICITANTE"], 403],
    ["POST", caminho, ["SVO"], 403],
    ["GET", caminho, undefined, 401],
    ["GET", `${caminho}/meus`, undefined, 401],
    ["POST", caminho, undefined, 401],
  ] as const)("%s %s com %j → %i", async (metodo, url, perfis, esperado) => {
    const { status } = await chamar(metodo, url, {
      perfis: perfis ? [...perfis] : undefined,
      body: metodo === "POST" ? corpoValido({ veiculoId }) : undefined,
    });
    expect(status).toBe(esperado);
  });
});

describe("revisão preventiva no abastecimento", () => {
  it("atualiza o odômetro e notifica na mesma transação", async () => {
    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      placa: "ABC1234",
      ativo: true,
      odometroAtual: new Prisma.Decimal(8000),
      kmProximaRevisao: new Prisma.Decimal(10000),
    });
    const { status } = await chamar("POST", caminho, {
      perfis: ["GESTOR"],
      body: corpoValido({ veiculoId, odometro: 9000 }),
    });
    expect(status).toBe(201);
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.abastecimentoCreate.mock.invocationCallOrder[0]!,
    );
    expect(mocks.veiculoUpdate).toHaveBeenCalledWith({
      where: { id: veiculoId },
      data: { odometroAtual: new Prisma.Decimal(9000) },
    });
    expect(mocks.notificacaoCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId,
          tipo: "REVISAO_PREVENTIVA_PROXIMA",
          referenciaId: veiculoId,
        }),
      ],
      skipDuplicates: true,
    });
  });
  it("não reduz o odômetro ao registrar abastecimento antigo", async () => {
    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      placa: "ABC1234",
      ativo: true,
      odometroAtual: new Prisma.Decimal(12000),
      kmProximaRevisao: null,
    });
    const { status } = await chamar("POST", caminho, {
      perfis: ["GESTOR"],
      body: corpoValido({ veiculoId, odometro: 9000, dataHora: "2026-10-01T10:00:00Z" }),
    });
    expect(status).toBe(201);
    expect(mocks.veiculoUpdate).not.toHaveBeenCalled();
    expect(mocks.notificacaoCreateMany).not.toHaveBeenCalled();
  });
  it("verifica 100% com a quilometragem atual mesmo num lançamento retroativo", async () => {
    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      placa: "ABC1234",
      ativo: true,
      odometroAtual: new Prisma.Decimal(10500),
      kmProximaRevisao: new Prisma.Decimal(10000),
    });
    expect(
      (
        await chamar("POST", caminho, {
          perfis: ["GESTOR"],
          body: corpoValido({ veiculoId, odometro: 9000, dataHora: "2026-10-01T10:00:00Z" }),
        })
      ).status,
    ).toBe(201);
    expect(mocks.veiculoUpdate).not.toHaveBeenCalled();
    expect(mocks.notificacaoCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ tipo: "REVISAO_PREVENTIVA_VENCIDA" })],
      }),
    );
  });
});
