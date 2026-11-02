import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  motoristaFindUnique: vi.fn(),
  veiculoFindUnique: vi.fn(),
  escalaCount: vi.fn(),
  escalaFindMany: vi.fn(),
  escalaFindUnique: vi.fn(),
  escalaFindUniqueOrThrow: vi.fn(),
  escalaCreate: vi.fn(),
  escalaUpdateMany: vi.fn(),
  auditoriaCreate: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => {
  const cliente: Record<string, unknown> = {
    $queryRaw: mocks.queryRaw,
    motorista: { findUnique: mocks.motoristaFindUnique },
    veiculo: { findUnique: mocks.veiculoFindUnique },
    escalaSvo: {
      count: mocks.escalaCount,
      findMany: mocks.escalaFindMany,
      findUnique: mocks.escalaFindUnique,
      findUniqueOrThrow: mocks.escalaFindUniqueOrThrow,
      create: mocks.escalaCreate,
      updateMany: mocks.escalaUpdateMany,
    },
    auditoriaSistema: { create: mocks.auditoriaCreate },
  };
  cliente.$transaction = (operacao: (tx: unknown) => unknown) => operacao(cliente);
  return { prisma: cliente };
});

import { app } from "../../../src/app";
import { calcularSituacaoEscala, turnosSeSobrepoem } from "../../../src/service/escala_svo_s";

const secret = "chave-sintetica-dos-testes-de-escalas";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const motoristaId = "00000000-0000-4000-8000-0000000000b1";
const veiculoId = "00000000-0000-4000-8000-0000000000a1";
const escalaId = "00000000-0000-4000-8000-0000000000e1";
const caminho = "/api/v1/svo/escalas";
const HORA = 60 * 60 * 1000;
const BASE = Date.now();
const daqui = (horas: number) => new Date(BASE + horas * HORA);
const iso = (horas: number) => daqui(horas).toISOString();

type Corpo = {
  statusCode?: number;
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

function escalaDoBanco(dados: Partial<Record<string, unknown>> = {}) {
  return {
    id: escalaId,
    motoristaId,
    veiculoId,
    inicioTurno: daqui(-1),
    fimTurno: daqui(11),
    observacoes: null,
    encerradaEm: null,
    criadoEm: daqui(-2),
    motorista: { id: motoristaId, telefone: "79999990000", usuario: { nome: "Plantonista" } },
    veiculo: { id: veiculoId, placa: "SVO1A23", modelo: "S10", status: "DISPONIVEL" },
    ...dados,
  };
}

const corpoValido = () => ({
  motoristaId,
  veiculoId,
  inicioTurno: iso(1),
  fimTurno: iso(13),
  observacoes: "Plantão noturno",
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
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.queryRaw.mockResolvedValue([{ locked: 1 }]);
  mocks.motoristaFindUnique.mockResolvedValue({
    id: motoristaId,
    ativo: true,
    validadeCnh: new Date("2099-12-31T00:00:00.000Z"),
  });
  mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, tipoFrota: "SVO", ativo: true });
  mocks.escalaCount.mockResolvedValue(1);
  mocks.escalaFindMany.mockResolvedValue([]);
  mocks.escalaFindUnique.mockResolvedValue(null);
  mocks.escalaCreate.mockImplementation(({ data }) =>
    Promise.resolve(escalaDoBanco({ ...data, observacoes: data.observacoes ?? null })),
  );
  mocks.escalaUpdateMany.mockResolvedValue({ count: 1 });
  mocks.escalaFindUniqueOrThrow.mockImplementation(() =>
    Promise.resolve(escalaDoBanco({ encerradaEm: new Date() })),
  );
  mocks.auditoriaCreate.mockResolvedValue({});
});

describe("acesso a /api/v1/svo/escalas", () => {
  it.each([
    ["GET", caminho],
    ["POST", caminho],
    ["PATCH", `${caminho}/${escalaId}/encerrar`],
  ])("%s %s exige autenticação e perfil ADMIN, GESTOR ou SVO", async (metodo, url) => {
    const body = metodo === "POST" ? corpoValido() : undefined;
    expect((await chamar(metodo, url, { body })).status).toBe(401);
    for (const perfil of ["MOTORISTA", "SOLICITANTE"]) {
      expect((await chamar(metodo, url, { perfis: [perfil], body })).status).toBe(403);
    }
    for (const perfil of ["ADMIN", "GESTOR", "SVO"]) {
      expect((await chamar(metodo, url, { perfis: [perfil], body })).status).toBeLessThan(300);
    }
    expect(mocks.motoristaFindUnique).toHaveBeenCalledTimes(metodo === "POST" ? 3 : 0);
  });

  it("não altera o acesso das demais rotas SVO (GESTOR continua sem acesso)", async () => {
    expect((await chamar("GET", "/api/v1/svo/viaturas", { perfis: ["GESTOR"] })).status).toBe(403);
  });
});

describe("GET /api/v1/svo/escalas", () => {
  it("lista com situação calculada, motorista, viatura e paginação", async () => {
    mocks.escalaFindMany.mockResolvedValue([escalaDoBanco()]);
    const resposta = await chamar("GET", caminho, { perfis: ["SVO"] });

    expect(resposta.status).toBe(200);
    expect(resposta.json.data).toEqual([
      expect.objectContaining({
        id: escalaId,
        situacao: "EM_ANDAMENTO",
        motorista: { id: motoristaId, nome: "Plantonista", telefone: "79999990000" },
        veiculo: expect.objectContaining({ placa: "SVO1A23", modelo: "S10" }),
        encerradaEm: null,
      }),
    ]);
    expect(resposta.json.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(mocks.escalaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: [{ inicioTurno: "desc" }, { id: "asc" }] }),
    );
  });

  it("filtra o plantão atual em ordem cronológica", async () => {
    await chamar("GET", `${caminho}?situacao=EM_ANDAMENTO&veiculoId=${veiculoId}&pageSize=5`, {
      perfis: ["GESTOR"],
    });
    const args = mocks.escalaFindMany.mock.calls[0]![0];
    expect(args.where).toEqual({
      AND: [
        {
          encerradaEm: null,
          inicioTurno: { lte: expect.any(Date) },
          fimTurno: { gt: expect.any(Date) },
        },
        { veiculoId },
      ],
    });
    expect(args.orderBy).toEqual([{ inicioTurno: "asc" }, { id: "asc" }]);
    expect(args.take).toBe(5);
  });

  it.each([
    ["AGENDADA", { encerradaEm: null, inicioTurno: { gt: expect.any(Date) } }],
    [
      "ENCERRADA",
      { OR: [{ encerradaEm: { not: null } }, { fimTurno: { lte: expect.any(Date) } }] },
    ],
  ])("filtra a situação %s", async (situacao, where) => {
    await chamar("GET", `${caminho}?situacao=${situacao}`, { perfis: ["ADMIN"] });
    expect(mocks.escalaFindMany.mock.calls[0]![0].where).toEqual({ AND: [where] });
  });

  it.each(["situacao=ATIVA", "motoristaId=abc", "pageSize=101", "page=0"])(
    "rejeita filtro inválido %s",
    async (query) => {
      expect((await chamar("GET", `${caminho}?${query}`, { perfis: ["SVO"] })).status).toBe(400);
      expect(mocks.escalaFindMany).not.toHaveBeenCalled();
    },
  );
});

describe("POST /api/v1/svo/escalas", () => {
  it("cadastra a escala com trava do motorista e auditoria sem observações", async () => {
    const resposta = await chamar("POST", caminho, { perfis: ["SVO"], body: corpoValido() });

    expect(resposta.status).toBe(201);
    expect(resposta.json).toEqual(
      expect.objectContaining({ situacao: "AGENDADA", observacoes: "Plantão noturno" }),
    );
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.queryRaw.mock.calls[0]).toContain(`motorista:${motoristaId}`);
    expect(mocks.escalaCreate.mock.calls[0]![0].data).toEqual({
      motoristaId,
      veiculoId,
      inicioTurno: expect.any(Date),
      fimTurno: expect.any(Date),
      observacoes: "Plantão noturno",
    });
    const auditoria = mocks.auditoriaCreate.mock.calls[0]![0].data;
    expect(auditoria).toEqual(
      expect.objectContaining({ usuarioId, acao: "CRIAR", tabelaAfetada: "escalas_svo" }),
    );
    expect(auditoria.dadosNovos).not.toHaveProperty("observacoes");
  });

  it("aceita turno já iniciado e observações vazias, ignorando campos extras", async () => {
    const resposta = await chamar("POST", caminho, {
      perfis: ["GESTOR"],
      body: { ...corpoValido(), inicioTurno: iso(-2), observacoes: "  ", encerradaEm: iso(0) },
    });
    expect(resposta.status).toBe(201);
    expect(resposta.json.situacao).toBe("EM_ANDAMENTO");
    const data = mocks.escalaCreate.mock.calls[0]![0].data;
    expect(data.observacoes).toBeUndefined();
    expect(data).not.toHaveProperty("encerradaEm");
  });

  it.each([
    ["sem corpo", {}, ["motoristaId", "veiculoId", "inicioTurno", "fimTurno"]],
    ["IDs inválidos", { motoristaId: "x", veiculoId: 1 }, ["motoristaId", "veiculoId"]],
    ["data sem fuso", { inicioTurno: "2026-11-10T07:00:00" }, ["inicioTurno"]],
    ["fim antes do início", { inicioTurno: iso(5), fimTurno: iso(4) }, ["fimTurno"]],
    ["fim igual ao início", { inicioTurno: iso(5), fimTurno: iso(5) }, ["fimTurno"]],
    ["turno acima de 24 horas", { inicioTurno: iso(1), fimTurno: iso(26) }, ["fimTurno"]],
    ["observações longas", { observacoes: "x".repeat(301) }, ["observacoes"]],
  ])("retorna 400 para %s", async (_caso, alteracao, campos) => {
    const body = Object.keys(alteracao).length ? { ...corpoValido(), ...alteracao } : {};
    const resposta = await chamar("POST", caminho, { perfis: ["SVO"], body });

    expect(resposta.status).toBe(400);
    expect(resposta.json.errors?.map((erro) => erro.campo).sort()).toEqual([...campos].sort());
    expect(mocks.escalaCreate).not.toHaveBeenCalled();
  });

  it("aceita turno de exatamente 24 horas", async () => {
    const body = { ...corpoValido(), inicioTurno: iso(1), fimTurno: iso(25) };
    expect((await chamar("POST", caminho, { perfis: ["SVO"], body })).status).toBe(201);
  });

  it("retorna 422 para turno que já terminou", async () => {
    const body = { ...corpoValido(), inicioTurno: iso(-13), fimTurno: iso(-1) };
    const resposta = await chamar("POST", caminho, { perfis: ["SVO"], body });
    expect(resposta.status).toBe(422);
    expect(resposta.json.errors?.[0]?.campo).toBe("fimTurno");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    [
      "motorista inexistente",
      () => mocks.motoristaFindUnique.mockResolvedValue(null),
      "motoristaId",
    ],
    [
      "motorista inativo",
      () =>
        mocks.motoristaFindUnique.mockResolvedValue({
          id: motoristaId,
          ativo: false,
          validadeCnh: new Date("2099-12-31T00:00:00.000Z"),
        }),
      "motoristaId",
    ],
    [
      "CNH vencendo antes do fim do turno",
      () =>
        mocks.motoristaFindUnique.mockResolvedValue({
          id: motoristaId,
          ativo: true,
          validadeCnh: new Date("2020-01-01T00:00:00.000Z"),
        }),
      "motoristaId",
    ],
    ["viatura inexistente", () => mocks.veiculoFindUnique.mockResolvedValue(null), "veiculoId"],
    [
      "viatura administrativa",
      () =>
        mocks.veiculoFindUnique.mockResolvedValue({
          id: veiculoId,
          tipoFrota: "ADMINISTRATIVA",
          ativo: true,
        }),
      "veiculoId",
    ],
    [
      "viatura inativa",
      () =>
        mocks.veiculoFindUnique.mockResolvedValue({
          id: veiculoId,
          tipoFrota: "SVO",
          ativo: false,
        }),
      "veiculoId",
    ],
  ])("retorna 422 para %s", async (_caso, preparar, campo) => {
    preparar();
    const resposta = await chamar("POST", caminho, { perfis: ["SVO"], body: corpoValido() });
    expect(resposta.status).toBe(422);
    expect(resposta.json.errors?.[0]?.campo).toBe(campo);
    expect(mocks.escalaCreate).not.toHaveBeenCalled();
  });

  it("retorna 409 quando o motorista já tem escala no mesmo horário", async () => {
    mocks.escalaFindMany.mockResolvedValue([
      { id: "outra", inicioTurno: daqui(10), fimTurno: daqui(22), encerradaEm: null },
    ]);
    const resposta = await chamar("POST", caminho, { perfis: ["SVO"], body: corpoValido() });

    expect(resposta.status).toBe(409);
    expect(mocks.escalaFindMany.mock.calls[0]![0].where).toEqual({
      motoristaId,
      inicioTurno: { lt: expect.any(Date) },
      fimTurno: { gt: expect.any(Date) },
    });
    expect(mocks.escalaCreate).not.toHaveBeenCalled();
  });

  it("permite reescalar o motorista quando a escala anterior foi cancelada", async () => {
    mocks.escalaFindMany.mockResolvedValue([
      { id: "cancelada", inicioTurno: daqui(1), fimTurno: daqui(13), encerradaEm: daqui(-1) },
    ]);
    expect((await chamar("POST", caminho, { perfis: ["SVO"], body: corpoValido() })).status).toBe(
      201,
    );
  });
});

describe("PATCH /api/v1/svo/escalas/:id/encerrar", () => {
  it("encerra a escala ativa e registra auditoria", async () => {
    const resposta = await chamar("PATCH", `${caminho}/${escalaId}/encerrar`, {
      perfis: ["SVO"],
    });

    expect(resposta.status).toBe(200);
    expect(resposta.json.situacao).toBe("ENCERRADA");
    expect(mocks.escalaUpdateMany).toHaveBeenCalledWith({
      where: { id: escalaId, encerradaEm: null, fimTurno: { gt: expect.any(Date) } },
      data: { encerradaEm: expect.any(Date) },
    });
    expect(mocks.auditoriaCreate.mock.calls[0]![0].data).toEqual(
      expect.objectContaining({
        acao: "ENCERRAR",
        registroId: escalaId,
        dadosNovos: { encerradaEm: expect.any(String), cancelada: false },
      }),
    );
  });

  it("retorna 404 para escala inexistente e 409 para escala já encerrada", async () => {
    mocks.escalaUpdateMany.mockResolvedValue({ count: 0 });
    const url = `${caminho}/${escalaId}/encerrar`;
    expect((await chamar("PATCH", url, { perfis: ["SVO"] })).status).toBe(404);

    mocks.escalaFindUnique.mockResolvedValue({ id: escalaId });
    expect((await chamar("PATCH", url, { perfis: ["SVO"] })).status).toBe(409);
    expect(mocks.auditoriaCreate).not.toHaveBeenCalled();
  });

  it("retorna 400 para ID inválido", async () => {
    const resposta = await chamar("PATCH", `${caminho}/abc/encerrar`, { perfis: ["SVO"] });
    expect(resposta.status).toBe(400);
    expect(mocks.escalaUpdateMany).not.toHaveBeenCalled();
  });
});

describe("regras de turno", () => {
  const agora = new Date("2026-11-10T12:00:00.000Z");
  const h = (horas: number) => new Date(agora.getTime() + horas * HORA);
  const turno = (inicio: number, fim: number, encerrada?: number) => ({
    inicioTurno: h(inicio),
    fimTurno: h(fim),
    encerradaEm: encerrada === undefined ? null : h(encerrada),
  });

  it.each([
    [turno(1, 13), "AGENDADA"],
    [turno(0, 12), "EM_ANDAMENTO"],
    [turno(-12, 0), "ENCERRADA"],
    [turno(-6, 6, -1), "ENCERRADA"],
    [turno(2, 14, -1), "ENCERRADA"],
  ])("calcula a situação %#", (dados, situacao) => {
    expect(calcularSituacaoEscala(dados, agora)).toBe(situacao);
  });

  it.each([
    [turno(0, 12), 6, 18, true],
    [turno(0, 12), 12, 24, false],
    [turno(12, 24), 0, 12, false],
    [turno(0, 12, 6), 6, 18, false],
    [turno(0, 12, 6), 5, 18, true],
    [turno(10, 22, 1), 0, 30, false],
  ])("detecta sobreposição %#", (existente, inicio, fim, esperado) => {
    expect(turnosSeSobrepoem(existente, h(inicio), h(fim))).toBe(esperado);
  });
});
