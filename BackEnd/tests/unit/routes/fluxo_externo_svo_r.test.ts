import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "fluxo-externo-svo-teste", expiresIn: 28800 }),
}));
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});

type Linha = Record<string, unknown>;

const db = vi.hoisted(() => ({
  solicitacoes: [] as Record<string, unknown>[],
  chamados: [] as Record<string, unknown>[],
  historico: [] as Record<string, unknown>[],
  auditoria: [] as Record<string, unknown>[],
  usuarios: new Map<string, string>(),
  falhas: { historico: false },
  lock: Promise.resolve() as Promise<void>,
}));

vi.mock("../../../src/lib/prisma", async () => {
  const { randomUUID } = await import("node:crypto");
  const { Prisma } = await import("@prisma/client");
  type Arg = {
    where: { id?: string | { in: string[] }; status?: unknown; versao?: unknown };
    data: Linha;
    skip: number;
    take: number;
  };
  const tabelas = ["solicitacoes", "chamados", "historico", "auditoria"] as const;
  const snapshot = () => structuredClone(tabelas.map((t) => db[t]));
  const restaurar = (copia: Linha[][]) =>
    tabelas.forEach((t, i) => db[t].splice(0, db[t].length, ...copia[i]!));
  const hidratar = (linha: Linha) => ({
    ...structuredClone(linha),
    chamadoSvo: db.chamados.find((c) => c.id === linha.chamadoSvoId) ?? null,
    historico: structuredClone(db.historico.filter((h) => h.solicitacaoExternaId === linha.id)),
  });
  const filtrar = ({ where }: Pick<Arg, "where">) =>
    db.solicitacoes.filter((s) => where.status === undefined || s.status === where.status);
  const buscar = ({ where }: Pick<Arg, "where">) => db.solicitacoes.find((s) => s.id === where.id);

  const cliente: Linha = {
    $queryRaw: async () => [{ ultimo_valor: 7 }],
    usuario: {
      findMany: async ({ where }: Arg) =>
        ((where.id as { in: string[] }).in ?? [])
          .filter((id) => db.usuarios.has(id))
          .map((id) => ({ id, nome: db.usuarios.get(id)! })),
    },
    solicitacaoExternaSvo: {
      findMany: async (a: Arg) =>
        filtrar(a)
          .slice(a.skip, a.skip + a.take)
          .map(hidratar),
      count: async (a: Arg) => filtrar(a).length,
      findUnique: async (a: Arg) => {
        const linha = buscar(a);
        return linha ? hidratar(linha) : null;
      },
      findUniqueOrThrow: async (a: Arg) => hidratar(buscar(a)!),
      updateMany: async ({ where, data }: Arg) => {
        const linha = db.solicitacoes.find(
          (s) => s.id === where.id && s.status === where.status && s.versao === where.versao,
        );
        if (linha) {
          const atualizacao = { ...data };
          const incremento = atualizacao.versao as { increment?: number } | undefined;
          if (incremento?.increment)
            atualizacao.versao = Number(linha.versao) + incremento.increment;
          Object.assign(linha, atualizacao, { atualizadoEm: new Date() });
        }
        return { count: linha ? 1 : 0 };
      },
    },
    solicitacaoExternaSvoHistorico: {
      create: async ({ data }: Arg) => {
        if (db.falhas.historico) throw new Error("falha simulada no banco");
        db.historico.push({ id: randomUUID(), ...data });
        return data;
      },
    },
    chamadoSvo: {
      create: async ({ data }: Arg) => {
        if (db.chamados.some((c) => c.numeroProtocolo === data.numeroProtocolo)) {
          throw new Prisma.PrismaClientKnownRequestError("duplicado", {
            code: "P2002",
            clientVersion: "6.19.3",
          });
        }
        const chamado = { id: randomUUID(), ordemColeta: null, atendente: null, ...data };
        db.chamados.push(chamado);
        return chamado;
      },
    },
    auditoriaSistema: {
      create: async ({ data }: Arg) => {
        db.auditoria.push(data);
        return data;
      },
    },
  };

  // Transação: rollback restaura o estado; FOR UPDATE serializa como o lock de linha do Postgres.
  cliente.$transaction = async (operacao: (tx: Linha) => Promise<unknown>) => {
    let copia = snapshot();
    let liberar: (() => void) | undefined;
    const tx: Linha = {
      ...cliente,
      $queryRaw: async (partes: TemplateStringsArray, ...valores: unknown[]) => {
        if (!partes.join("?").includes("FOR UPDATE")) return [{ ultimo_valor: 7 }];
        const anterior = db.lock;
        db.lock = new Promise<void>((resolve) => (liberar = resolve));
        await anterior;
        copia = snapshot();
        return [{ id: valores[0] }];
      },
    };
    try {
      return await operacao(tx);
    } catch (error) {
      restaurar(copia);
      throw error;
    } finally {
      liberar?.();
    }
  };
  return { prisma: cliente };
});

import { app } from "../../../src/app";

const secret = "fluxo-externo-svo-teste";
const ids = {
  externo: "00000000-0000-4000-8000-0000000000e1",
  atendente: "00000000-0000-4000-8000-0000000000a1",
  admin: "00000000-0000-4000-8000-0000000000d1",
  gestor: "00000000-0000-4000-8000-0000000000c1",
  gestor2: "00000000-0000-4000-8000-0000000000c2",
};
const solId = "10000000-0000-4000-8000-000000000001";
const ABERTURA = new Date("2026-11-20T10:00:00.000Z");
const BASE = "/api/v1/solicitacoes-externas-svo";

type Corpo = {
  statusCode?: number;
  message?: string;
  mensagem?: string;
  errors?: Array<{ campo: string; mensagem: string }>;
  data?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  dados?: Record<string, unknown> & { historico?: Array<Record<string, unknown>> };
  [chave: string]: unknown;
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

async function chamar(
  metodo: string,
  caminho: string,
  {
    perfis,
    usuario = ids.atendente,
    body,
    chave,
  }: { perfis?: string[]; usuario?: string; body?: unknown; chave?: string } = {},
) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(chave && { "idempotency-key": chave }),
      ...(perfis && {
        authorization: `Bearer ${signTestToken({ perfis }, secret, { subject: usuario })}`,
      }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: resposta.status, json: (await resposta.json()) as Corpo };
}

const atendente = { perfis: ["SVO"], usuario: ids.atendente };
const triar = (decisao: string, justificativa?: string, id = solId) =>
  chamar("PATCH", `${BASE}/${id}/triagem`, {
    ...atendente,
    body: { decisao, ...(justificativa && { justificativa }) },
  });

// Registro no formato gravado pelo portal do solicitante (S19FROTA-281).
function solicitacao(dados: Linha = {}): Linha {
  return {
    id: solId,
    protocolo: "EXT-2026-000001",
    solicitanteId: ids.externo,
    chaveIdempotencia: "20000000-0000-4000-8000-000000000001",
    status: "AGUARDANDO_TRIAGEM",
    versao: 0,
    nomeContato: "Maria Sintética",
    telefoneContato: "79999990000",
    contatoEmail: null,
    enderecoOcorrencia: "Rua Fictícia, 100, Aracaju",
    relatoOcorrencia: "Óbito em domicílio, família aguardando orientação.",
    complementacaoSolicitada: null,
    complementacaoEnviada: null,
    observacaoTriagem: null,
    motivoRecusa: null,
    justificativaDecisao: null,
    atendenteTriagemId: null,
    triadaEm: null,
    criadoEm: ABERTURA,
    atualizadoEm: ABERTURA,
    ...dados,
  };
}

beforeEach(() => {
  db.solicitacoes.length = 0;
  db.chamados.length = 0;
  db.historico.length = 0;
  db.auditoria.length = 0;
  db.falhas.historico = false;
  db.lock = Promise.resolve();
  db.usuarios = new Map([
    [ids.externo, "Maria Sintética"],
    [ids.atendente, "Atendente SVO"],
    [ids.admin, "Admin"],
    [ids.gestor, "Gestor Um"],
    [ids.gestor2, "Gestor Dois"],
  ]);
});

describe("triagem da atendente SVO (S19FROTA-283)", () => {
  const rotas: Array<[string, string, unknown?]> = [
    ["GET", `${BASE}/triagem`],
    ["GET", `${BASE}/triagem/${solId}`],
    ["PATCH", `${BASE}/${solId}/triagem`, { decisao: "ENCAMINHAR" }],
  ];

  it.each(rotas)("%s %s exige login (401)", async (metodo, caminho, body) => {
    expect((await chamar(metodo, caminho, { body })).status).toBe(401);
  });

  it.each(["GESTOR", "MOTORISTA", "SOLICITANTE", "EXTERNO"])(
    "nega a triagem para %s (403)",
    async (perfil) => {
      db.solicitacoes.push(solicitacao());
      for (const [metodo, caminho, body] of rotas) {
        expect((await chamar(metodo, caminho, { perfis: [perfil], body })).status).toBe(403);
      }
      expect(db.solicitacoes[0]!.status).toBe("AGUARDANDO_TRIAGEM");
    },
  );

  it.each(["SVO", "ADMIN"])("permite a triagem para %s", async (perfil) => {
    db.solicitacoes.push(solicitacao());
    const { status } = await chamar("PATCH", `${BASE}/${solId}/triagem`, {
      perfis: [perfil],
      usuario: ids.admin,
      body: { decisao: "ENCAMINHAR" },
    });
    expect(status).toBe(200);
  });

  it.each([
    [{ decisao: "APROVAR" }, "decisao"],
    [{ decisao: "RECUSAR" }, "justificativa"],
    [{ decisao: "SOLICITAR_COMPLEMENTACAO" }, "justificativa"],
    [{ decisao: "ENCAMINHAR", estado: "APROVADA" }, ""],
    [{}, "decisao"],
  ])("rejeita a triagem %j (400)", async (body, campo) => {
    db.solicitacoes.push(solicitacao());
    const { status, json } = await chamar("PATCH", `${BASE}/${solId}/triagem`, {
      ...atendente,
      body,
    });
    expect(status).toBe(400);
    expect(json.errors?.some((e) => e.campo === campo)).toBe(true);
    expect(db.solicitacoes[0]!.status).toBe("AGUARDANDO_TRIAGEM");
  });

  it("rejeita id inválido (400) e devolve 404 para inexistente", async () => {
    const inexistente = "30000000-0000-4000-8000-000000000009";
    expect((await chamar("GET", `${BASE}/triagem/abc`, atendente)).status).toBe(400);
    expect((await chamar("GET", `${BASE}/triagem/${inexistente}`, atendente)).status).toBe(404);
    expect((await triar("ENCAMINHAR", undefined, inexistente)).status).toBe(404);
  });

  it("lista AGUARDANDO_TRIAGEM por padrão e filtra as devolvidas", async () => {
    db.solicitacoes.push(
      solicitacao(),
      solicitacao({ id: "10000000-0000-4000-8000-000000000002", protocolo: "EXT-2026-000002" }),
      solicitacao({
        id: "10000000-0000-4000-8000-000000000003",
        protocolo: "EXT-2026-000003",
        status: "AGUARDANDO_GESTOR",
        atendenteTriagemId: ids.atendente,
        triadaEm: ABERTURA,
      }),
      solicitacao({
        id: "10000000-0000-4000-8000-000000000004",
        protocolo: "EXT-2026-000004",
        status: "AGUARDANDO_COMPLEMENTACAO",
        complementacaoSolicitada: "Informe o ponto de referência.",
      }),
    );
    const fila = await chamar("GET", `${BASE}/triagem`, atendente);
    expect(fila.status).toBe(200);
    expect(fila.json.data?.map((s) => s.protocolo)).toEqual(["EXT-2026-000001", "EXT-2026-000002"]);
    expect(fila.json.meta).toEqual({ page: 1, pageSize: 10, total: 2, totalPages: 1 });

    const devolvidas = await chamar("GET", `${BASE}/triagem?estado=AGUARDANDO_COMPLEMENTACAO`, {
      ...atendente,
    });
    expect(devolvidas.json.data?.map((s) => [s.protocolo, s.status])).toEqual([
      ["EXT-2026-000004", "DEVOLVIDA_PARA_COMPLEMENTACAO"],
    ]);
    expect((await chamar("GET", `${BASE}/triagem?estado=APROVADA`, atendente)).status).toBe(400);
  });

  it("consulta os dados de triagem com o histórico e o complemento enviado", async () => {
    db.solicitacoes.push(solicitacao());
    db.historico.push(
      {
        solicitacaoExternaId: solId,
        acao: "SOLICITACAO_CRIADA",
        perfilAutor: "EXTERNO",
        statusAnterior: null,
        statusNovo: "AGUARDANDO_TRIAGEM",
        autorId: ids.externo,
        mensagemPublica: "Solicitação recebida.",
        observacaoInterna: null,
        criadoEm: ABERTURA,
      },
      {
        solicitacaoExternaId: solId,
        acao: "COMPLEMENTACAO_ENVIADA",
        perfilAutor: "EXTERNO",
        statusAnterior: "AGUARDANDO_COMPLEMENTACAO",
        statusNovo: "AGUARDANDO_TRIAGEM",
        autorId: ids.externo,
        mensagemPublica: "Complementação enviada: Fica ao lado da padaria.",
        observacaoInterna: null,
        criadoEm: ABERTURA,
      },
    );
    const { status, json } = await chamar("GET", `${BASE}/triagem/${solId}`, atendente);
    expect(status).toBe(200);
    expect(json).toMatchObject({
      protocolo: "EXT-2026-000001",
      status: "AGUARDANDO_TRIAGEM",
      nomeSolicitante: "Maria Sintética",
      contato: "79999990000",
      descricao: "Óbito em domicílio, família aguardando orientação.",
    });
    expect(json.historico).toEqual([
      expect.objectContaining({ tipo: "CRIACAO", autorNome: "Maria Sintética" }),
      expect.objectContaining({
        tipo: "COMPLEMENTO",
        statusAnterior: "DEVOLVIDA_PARA_COMPLEMENTACAO",
        justificativa: "Fica ao lado da padaria.",
      }),
    ]);
  });

  it("solicita complementação com mensagem pública, sem concluir a triagem", async () => {
    db.solicitacoes.push(solicitacao());
    const { status, json } = await triar("SOLICITAR_COMPLEMENTACAO", "Informe a referência.");
    expect(status).toBe(200);
    expect(json.dados).toMatchObject({
      estado: "AGUARDANDO_COMPLEMENTACAO",
      status: "DEVOLVIDA_PARA_COMPLEMENTACAO",
      mensagemParaSolicitante: "Informe a referência.",
      triadaEm: expect.any(String),
      atendenteTriagem: { id: ids.atendente, nome: "Atendente SVO" },
    });
    expect(json.dados?.historico?.[0]).toMatchObject({
      tipo: "PEDIDO_COMPLEMENTO",
      statusAnterior: "AGUARDANDO_TRIAGEM",
      statusNovo: "DEVOLVIDA_PARA_COMPLEMENTACAO",
      autorNome: "Atendente SVO",
    });
  });

  it("encaminha ao gestor com autoria, horário e auditoria sem texto livre", async () => {
    db.solicitacoes.push(solicitacao());
    const { status, json } = await triar("ENCAMINHAR", "Dados conferidos por telefone.");
    expect(status).toBe(200);
    expect(json.dados).toMatchObject({
      estado: "AGUARDANDO_GESTOR",
      relatoTriagem: "Dados conferidos por telefone.",
      atendenteTriagem: { id: ids.atendente, nome: "Atendente SVO" },
      mensagemParaSolicitante: null,
    });
    expect(json.dados?.triadaEm).toEqual(expect.any(String));
    expect(db.auditoria).toEqual([
      {
        usuarioId: ids.atendente,
        acao: "ENCAMINHAR_GESTOR",
        tabelaAfetada: "solicitacoes_externas_svo",
        registroId: solId,
        dadosNovos: {
          protocolo: "EXT-2026-000001",
          estadoAnterior: "AGUARDANDO_TRIAGEM",
          estadoNovo: "AGUARDANDO_GESTOR",
        },
      },
    ]);
  });

  it("recusa com justificativa interna, inclusive quando aguardava complementação", async () => {
    db.solicitacoes.push(
      solicitacao({
        status: "AGUARDANDO_COMPLEMENTACAO",
        complementacaoSolicitada: "Informe o ponto de referência.",
      }),
    );
    const { status, json } = await triar("RECUSAR", "Solicitante não retornou o contato.");
    expect(status).toBe(200);
    expect(json.dados).toMatchObject({
      estado: "RECUSADA",
      justificativa: "Solicitante não retornou o contato.",
      // O portal volta à mensagem padrão de recusa: a justificativa não é exposta.
      mensagemParaSolicitante: null,
    });
  });

  it.each([
    ["ENCAMINHAR", "AGUARDANDO_COMPLEMENTACAO"],
    ["SOLICITAR_COMPLEMENTACAO", "AGUARDANDO_COMPLEMENTACAO"],
    ["ENCAMINHAR", "AGUARDANDO_GESTOR"],
    ["RECUSAR", "AGUARDANDO_GESTOR"],
    ["SOLICITAR_COMPLEMENTACAO", "AGUARDANDO_GESTOR"],
    ["ENCAMINHAR", "APROVADA"],
    ["RECUSAR", "RECUSADA"],
  ])("bloqueia %s quando a solicitação está %s", async (decisao, estado) => {
    db.solicitacoes.push(
      solicitacao({
        status: estado,
        complementacaoSolicitada: "x",
        atendenteTriagemId: ids.admin,
        triadaEm: ABERTURA,
      }),
    );
    const { status } = await triar(decisao, "Justificativa qualquer.");
    expect(status).toBe(decisao === "RECUSAR" && estado === "AGUARDANDO_GESTOR" ? 403 : 409);
    expect(db.solicitacoes[0]!.status).toBe(estado);
    expect(db.historico).toHaveLength(0);
    expect(db.auditoria).toHaveLength(0);
  });

  it("impede triar a própria solicitação (403)", async () => {
    db.solicitacoes.push(solicitacao({ solicitanteId: ids.atendente }));
    expect((await triar("ENCAMINHAR")).status).toBe(403);
    expect(db.solicitacoes[0]!.status).toBe("AGUARDANDO_TRIAGEM");
  });

  it("só o encaminhamento leva a solicitação ao gestor", async () => {
    const outra = (n: number) => ({
      id: `10000000-0000-4000-8000-00000000000${n}`,
      protocolo: `EXT-2026-00000${n}`,
    });
    db.solicitacoes.push(solicitacao(), solicitacao(outra(2)), solicitacao(outra(3)));
    await triar("SOLICITAR_COMPLEMENTACAO", "Informe a referência.", outra(2).id);
    await triar("RECUSAR", "Fora da área.", outra(3).id);
    await triar("ENCAMINHAR");
    expect(db.solicitacoes.map((s) => s.status)).toEqual([
      "AGUARDANDO_GESTOR",
      "AGUARDANDO_COMPLEMENTACAO",
      "RECUSADA",
    ]);
  });

  it("desfaz a triagem se o histórico não puder ser gravado", async () => {
    db.solicitacoes.push(solicitacao());
    db.falhas.historico = true;
    expect((await triar("ENCAMINHAR")).status).toBe(500);
    expect(db.solicitacoes[0]).toMatchObject({
      status: "AGUARDANDO_TRIAGEM",
      atendenteTriagemId: null,
    });
    expect(db.auditoria).toHaveLength(0);
  });
});
