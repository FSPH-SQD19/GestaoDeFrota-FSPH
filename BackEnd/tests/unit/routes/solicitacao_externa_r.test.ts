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

const mocks = vi.hoisted(() => {
  const m = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    historicoCreate: vi.fn(),
    auditoriaCreate: vi.fn(),
    queryRaw: vi.fn(),
    transaction: vi.fn(),
  };
  return {
    ...m,
    tx: {
      solicitacaoExternaSvo: {
        create: m.create,
        findUnique: m.findUnique,
        updateMany: m.updateMany,
        findUniqueOrThrow: m.findUniqueOrThrow,
      },
      solicitacaoExternaSvoHistorico: { create: m.historicoCreate },
      auditoriaSistema: { create: m.auditoriaCreate },
      $queryRaw: m.queryRaw,
    },
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    solicitacaoExternaSvo: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
    },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../../../src/app";

const secret = "chave-sintetica-dos-testes-de-solicitacao-externa";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const solicitacaoId = "00000000-0000-4000-8000-0000000000b1";
const chave = "00000000-0000-4000-8000-0000000000c1";
const agora = new Date("2026-11-17T12:00:00.000Z");
const base = "/api/v1/svo/solicitacoes-externas";

const corpo = {
  contatoNome: "Maria Souza",
  contatoTelefone: "(79) 99999-0000",
  nomeFalecido: "João Souza",
  enderecoOcorrencia: "Rua A, 10, Aracaju",
  relatoOcorrencia: "Relato de teste com detalhes suficientes.",
};

const registro = {
  id: solicitacaoId,
  protocolo: "SVOE-2026-0001",
  solicitanteId: usuarioId,
  chaveIdempotencia: chave,
  nomeContato: "Maria Souza",
  telefoneContato: "79999990000",
  contatoEmail: null,
  nomeFalecido: corpo.nomeFalecido,
  enderecoOcorrencia: "Rua A, 10, Aracaju",
  relatoOcorrencia: "Relato de teste com detalhes suficientes.",
  status: "AGUARDANDO_TRIAGEM",
  tipoSolicitante: "FAMILIAR",
  instituicaoSolicitante: null,
  municipioOcorrencia: null,
  pontoReferencia: null,
  complementacaoSolicitada: null,
  complementacaoEnviada: null,
  motivoRecusa: null,
  versao: 0,
  criadoEm: agora,
  atualizadoEm: agora,
  historico: [],
};

type Corpo = {
  statusCode?: number;
  message?: string;
  data?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  errors?: Array<{ campo: string; mensagem: string }>;
  [chave: string]: unknown;
};

type Opcoes = {
  perfis?: string[];
  body?: unknown;
  metodo?: string;
  cabecalhos?: Record<string, string>;
};

let server: Server;
let baseUrl: string;

async function chamar(url: string, { perfis, body, metodo, cabecalhos }: Opcoes = {}) {
  const temCorpo = body !== undefined;
  const resposta = await fetch(`${baseUrl}${url}`, {
    method: metodo ?? (temCorpo ? "POST" : "GET"),
    headers: {
      ...(temCorpo && { "content-type": "application/json" }),
      ...(perfis && {
        authorization: `Bearer ${signTestToken({ perfis }, secret, { subject: usuarioId })}`,
      }),
      ...cabecalhos,
    },
    body: !temCorpo ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return {
    status: resposta.status,
    location: resposta.headers.get("location"),
    json: (await resposta.json()) as Corpo,
  };
}

beforeAll(async () => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.queryRaw.mockResolvedValue([{ ultimo_valor: 1 }]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue(registro);
  mocks.historicoCreate.mockResolvedValue({});
  mocks.auditoriaCreate.mockResolvedValue({});
  mocks.findMany.mockResolvedValue([registro]);
  mocks.count.mockResolvedValue(1);
});

describe("controle de acesso", () => {
  it("exige autenticação em todas as rotas", async () => {
    expect((await chamar(base)).status).toBe(401);
    expect((await chamar(`${base}/${solicitacaoId}`)).status).toBe(401);
    expect(
      (await chamar(base, { body: corpo, cabecalhos: { "idempotency-key": chave } })).status,
    ).toBe(401);
    expect(
      (
        await chamar(`${base}/${solicitacaoId}/complementacao`, {
          metodo: "PATCH",
          body: { complemento: "Mais detalhes." },
        })
      ).status,
    ).toBe(401);
  });

  it.each(["ADMIN", "GESTOR", "SVO", "MOTORISTA", "SOLICITANTE"])(
    "retorna 403 para o perfil interno %s",
    async (perfil) => {
      expect((await chamar(base, { perfis: [perfil] })).status).toBe(403);
      expect(
        (
          await chamar(base, {
            perfis: [perfil],
            body: corpo,
            cabecalhos: { "idempotency-key": chave },
          })
        ).status,
      ).toBe(403);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.findMany).not.toHaveBeenCalled();
    },
  );
});

describe("POST /api/v1/svo/solicitacoes-externas", () => {
  it("cria (201), devolve o protocolo e o endereço do recurso", async () => {
    const resposta = await chamar(base, {
      perfis: ["EXTERNO"],
      body: corpo,
      cabecalhos: { "idempotency-key": chave },
    });

    expect(resposta.status).toBe(201);
    expect(resposta.location).toBe(`${base}/${solicitacaoId}`);
    expect(resposta.json).toMatchObject({
      id: solicitacaoId,
      protocolo: "SVOE-2026-0001",
      situacao: "Recebida",
    });
    expect(resposta.json).not.toHaveProperty("estado");
    expect(resposta.json).not.toHaveProperty("solicitanteId");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          solicitanteId: usuarioId,
          telefoneContato: "79999990000",
          nomeFalecido: corpo.nomeFalecido,
        }),
      }),
    );
  });

  it("ignora dono e estado forjados no corpo", async () => {
    await chamar(base, {
      perfis: ["EXTERNO"],
      body: { ...corpo, solicitanteId: "00000000-0000-4000-8000-0000000000ff", estado: "APROVADA" },
      cabecalhos: { "idempotency-key": chave },
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ solicitanteId: usuarioId, status: "AGUARDANDO_TRIAGEM" }),
      }),
    );
  });

  it("reenvio com a mesma chave devolve 200 sem criar de novo", async () => {
    mocks.findUnique.mockResolvedValue({ ...registro, historico: [] });

    const resposta = await chamar(base, {
      perfis: ["EXTERNO"],
      body: corpo,
      cabecalhos: { "idempotency-key": chave },
    });

    expect(resposta.status).toBe(200);
    expect(resposta.json).toMatchObject({ protocolo: "SVOE-2026-0001" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("retorna 400 sem o cabeçalho Idempotency-Key", async () => {
    const resposta = await chamar(base, { perfis: ["EXTERNO"], body: corpo });

    expect(resposta.status).toBe(400);
    expect(resposta.json.errors?.[0]?.campo).toBe("Idempotency-Key");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("retorna 400 para Idempotency-Key que não é UUID", async () => {
    const resposta = await chamar(base, {
      perfis: ["EXTERNO"],
      body: corpo,
      cabecalhos: { "idempotency-key": "abc" },
    });

    expect(resposta.status).toBe(400);
  });

  it("retorna 400 com os campos inválidos", async () => {
    const resposta = await chamar(base, {
      perfis: ["EXTERNO"],
      body: {
        contatoNome: "A",
        contatoTelefone: "123",
        nomeFalecido: "A",
        enderecoOcorrencia: "R",
        relatoOcorrencia: "x",
      },
      cabecalhos: { "idempotency-key": chave },
    });

    expect(resposta.status).toBe(400);
    expect((resposta.json.errors ?? []).map((erro) => erro.campo).sort()).toEqual([
      "contatoNome",
      "contatoTelefone",
      "enderecoOcorrencia",
      "nomeFalecido",
      "relatoOcorrencia",
    ]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON malformado", async () => {
    const resposta = await chamar(base, {
      perfis: ["EXTERNO"],
      body: "{invalido",
      cabecalhos: { "idempotency-key": chave },
    });

    expect(resposta.status).toBe(400);
  });
});

describe("GET /api/v1/svo/solicitacoes-externas", () => {
  it("lista só as próprias solicitações, sem campos internos", async () => {
    const resposta = await chamar(`${base}?page=1&pageSize=5`, { perfis: ["EXTERNO"] });

    expect(resposta.status).toBe(200);
    expect(resposta.json.meta).toEqual({ page: 1, pageSize: 5, total: 1, totalPages: 1 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ solicitanteId: usuarioId }) }),
    );
    expect(Object.keys(resposta.json.data?.[0] ?? {}).sort()).toEqual([
      "atualizadoEm",
      "criadoEm",
      "id",
      "mensagem",
      "permiteComplementar",
      "protocolo",
      "situacao",
    ]);
  });

  it("retorna 400 para filtros inválidos", async () => {
    const resposta = await chamar(`${base}?pageSize=1000&estado=OUTRO`, { perfis: ["EXTERNO"] });

    expect(resposta.status).toBe(400);
    expect((resposta.json.errors ?? []).map((erro) => erro.campo).sort()).toEqual([
      "estado",
      "pageSize",
    ]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/svo/solicitacoes-externas/:id", () => {
  it("devolve o detalhe da própria solicitação", async () => {
    mocks.findFirst.mockResolvedValue({ ...registro, historico: [] });

    const resposta = await chamar(`${base}/${solicitacaoId}`, { perfis: ["EXTERNO"] });

    expect(resposta.status).toBe(200);
    expect(resposta.json).toMatchObject({ protocolo: "SVOE-2026-0001", complementos: [] });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: solicitacaoId, solicitanteId: usuarioId } }),
    );
  });

  it("retorna 404 para solicitação de outra pessoa", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect((await chamar(`${base}/${solicitacaoId}`, { perfis: ["EXTERNO"] })).status).toBe(404);
  });

  it("retorna 400 para id inválido", async () => {
    const resposta = await chamar(`${base}/abc`, { perfis: ["EXTERNO"] });

    expect(resposta.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/svo/solicitacoes-externas/:id/complementacao", () => {
  const caminho = `${base}/${solicitacaoId}/complementacao`;
  const corpoComplemento = { complemento: "O ponto de referência é a praça central." };

  it("registra o complemento (200)", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({
        id: solicitacaoId,
        status: "AGUARDANDO_COMPLEMENTACAO",
        versao: 2,
      })
      .mockResolvedValueOnce({
        ...registro,
        status: "AGUARDANDO_TRIAGEM",
        historico: [
          {
            acao: "COMPLEMENTACAO_ENVIADA",
            statusAnterior: "AGUARDANDO_COMPLEMENTACAO",
            statusNovo: "AGUARDANDO_TRIAGEM",
            mensagemPublica: `Complementação enviada: ${corpoComplemento.complemento}`,
            criadoEm: agora,
          },
        ],
      });
    mocks.findUnique.mockResolvedValue({
      ...registro,
      status: "AGUARDANDO_COMPLEMENTACAO",
      versao: 2,
      historico: [],
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({
      ...registro,
      status: "AGUARDANDO_TRIAGEM",
      complementacaoEnviada: corpoComplemento.complemento,
      historico: [],
    });

    const resposta = await chamar(caminho, {
      perfis: ["EXTERNO"],
      metodo: "PATCH",
      body: corpoComplemento,
    });

    expect(resposta.status).toBe(200);
    expect(resposta.json).toMatchObject({ situacao: "Recebida" });
  });

  it("retorna 422 quando a solicitação não está aguardando complementação", async () => {
    mocks.findFirst.mockResolvedValue({ id: solicitacaoId, status: "AGUARDANDO_GESTOR" });

    const resposta = await chamar(caminho, {
      perfis: ["EXTERNO"],
      metodo: "PATCH",
      body: corpoComplemento,
    });

    expect(resposta.status).toBe(422);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("retorna 404 para solicitação de outra pessoa", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const resposta = await chamar(caminho, {
      perfis: ["EXTERNO"],
      metodo: "PATCH",
      body: corpoComplemento,
    });

    expect(resposta.status).toBe(404);
  });

  it("retorna 400 para complemento inválido", async () => {
    const resposta = await chamar(caminho, {
      perfis: ["EXTERNO"],
      metodo: "PATCH",
      body: { complemento: "ok" },
    });

    expect(resposta.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
