import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { HttpError } from "../../../src/lib/http_error";
import {
  chaveIdempotenciaSchema,
  complementarSolicitacaoExterna,
  complementarSolicitacaoExternaSchema,
  criarSolicitacaoExterna,
  criarSolicitacaoExternaSchema,
  detalharSolicitacaoExterna,
  listarSolicitacoesExternas,
  listarSolicitacoesExternasSchema,
  serializarSolicitacaoExterna,
  solicitacaoExternaIdSchema,
} from "../../../src/service/solicitacao_externa_s";

const usuarioId = "00000000-0000-4000-8000-000000000001";
const solicitacaoId = "00000000-0000-4000-8000-0000000000b1";
const chave = "00000000-0000-4000-8000-0000000000c1";
const agora = new Date("2026-11-17T12:00:00.000Z");

const entrada = {
  contatoNome: "Maria Souza",
  contatoTelefone: "79999990000",
  enderecoOcorrencia: "Rua A, 10, Aracaju",
  relatoOcorrencia: "Relato de teste com detalhes suficientes.",
};

const registro = {
  id: solicitacaoId,
  protocolo: "EXT-2026-000001",
  solicitanteId: usuarioId,
  chaveIdempotencia: chave,
  estado: "AGUARDANDO_TRIAGEM",
  ...entrada,
  contatoEmail: null,
  mensagemParaSolicitante: null,
  criadoEm: agora,
  atualizadoEm: agora,
};

async function erroDe(promessa: Promise<unknown>): Promise<HttpError> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof HttpError) return erro;
    throw erro;
  }
  throw new Error("Era esperado um HttpError.");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.queryRaw.mockResolvedValue([{ n: 1 }]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue(registro);
  mocks.historicoCreate.mockResolvedValue({});
  mocks.auditoriaCreate.mockResolvedValue({});
});

describe("criarSolicitacaoExternaSchema", () => {
  it("normaliza o telefone e descarta campos extras", () => {
    const resultado = criarSolicitacaoExternaSchema.parse({
      ...entrada,
      contatoTelefone: "(79) 99999-0000",
      estado: "APROVADA",
      solicitanteId: "outro",
    });

    expect(resultado).toEqual(entrada);
  });

  it("aceita e-mail opcional", () => {
    expect(
      criarSolicitacaoExternaSchema.safeParse({ ...entrada, contatoEmail: "maria@exemplo.com" })
        .success,
    ).toBe(true);
  });

  it.each([
    { campo: "nome ausente", dados: { ...entrada, contatoNome: undefined } },
    { campo: "nome curto", dados: { ...entrada, contatoNome: "A" } },
    { campo: "telefone inválido", dados: { ...entrada, contatoTelefone: "123" } },
    { campo: "telefone com DDD inválido", dados: { ...entrada, contatoTelefone: "(00) 99999-0000" } },
    { campo: "e-mail inválido", dados: { ...entrada, contatoEmail: "maria" } },
    { campo: "endereço curto", dados: { ...entrada, enderecoOcorrencia: "Rua" } },
    { campo: "relato curto", dados: { ...entrada, relatoOcorrencia: "curto" } },
    { campo: "relato muito longo", dados: { ...entrada, relatoOcorrencia: "x".repeat(2001) } },
  ])("rejeita $campo", ({ dados }) => {
    expect(criarSolicitacaoExternaSchema.safeParse(dados).success).toBe(false);
  });
});

describe("outros schemas", () => {
  it("complemento exige texto com tamanho mínimo e máximo", () => {
    expect(complementarSolicitacaoExternaSchema.safeParse({ complemento: "ok" }).success).toBe(false);
    expect(
      complementarSolicitacaoExternaSchema.safeParse({ complemento: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(
      complementarSolicitacaoExternaSchema.safeParse({ complemento: "Mais detalhes." }).success,
    ).toBe(true);
  });

  it("listagem usa paginação padrão e rejeita valores inválidos", () => {
    expect(listarSolicitacoesExternasSchema.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(listarSolicitacoesExternasSchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(listarSolicitacoesExternasSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(listarSolicitacoesExternasSchema.safeParse({ estado: "OUTRO" }).success).toBe(false);
  });

  it("id e chave de idempotência precisam ser UUID", () => {
    expect(solicitacaoExternaIdSchema.safeParse({ id: "abc" }).success).toBe(false);
    expect(chaveIdempotenciaSchema.safeParse("abc").success).toBe(false);
    expect(chaveIdempotenciaSchema.safeParse(undefined).success).toBe(false);
    expect(chaveIdempotenciaSchema.safeParse(chave).success).toBe(true);
  });
});

describe("serializarSolicitacaoExterna (resposta pública)", () => {
  it("expõe somente campos públicos", () => {
    const publico = serializarSolicitacaoExterna({ ...registro, historico: [] });

    expect(Object.keys(publico).sort()).toEqual([
      "atualizadoEm",
      "complementos",
      "criadoEm",
      "dadosEnviados",
      "id",
      "mensagem",
      "permiteComplementar",
      "protocolo",
      "situacao",
    ]);
    expect(publico).not.toHaveProperty("estado");
    expect(publico).not.toHaveProperty("solicitanteId");
    expect(publico).not.toHaveProperty("chaveIdempotencia");
    expect(publico).not.toHaveProperty("mensagemParaSolicitante");
  });

  it.each([
    ["AGUARDANDO_TRIAGEM", "Recebida", false],
    ["AGUARDANDO_COMPLEMENTACAO", "Precisamos de mais informações", true],
    ["AGUARDANDO_GESTOR", "Em análise", false],
    ["APROVADA", "Aprovada", false],
    ["RECUSADA", "Não atendida", false],
  ])("estado %s vira a situação pública %s", (estado, situacao, permiteComplementar) => {
    const publico = serializarSolicitacaoExterna({ ...registro, estado, historico: [] });

    expect(publico.situacao).toBe(situacao);
    expect(publico.permiteComplementar).toBe(permiteComplementar);
  });

  it("usa o texto do atendimento só na complementação e na recusa", () => {
    const texto = "Informe o ponto de referência.";

    expect(
      serializarSolicitacaoExterna({
        ...registro,
        estado: "AGUARDANDO_COMPLEMENTACAO",
        mensagemParaSolicitante: texto,
        historico: [],
      }).mensagem,
    ).toBe(texto);
    expect(
      serializarSolicitacaoExterna({
        ...registro,
        estado: "AGUARDANDO_GESTOR",
        mensagemParaSolicitante: texto,
        historico: [],
      }).mensagem,
    ).not.toBe(texto);
  });

  it("não quebra com um estado desconhecido", () => {
    expect(
      serializarSolicitacaoExterna({ ...registro, estado: "NOVO_ESTADO", historico: [] }).situacao,
    ).toBe("Em andamento");
  });
});

describe("criarSolicitacaoExterna", () => {
  it("cria com protocolo, histórico e auditoria na mesma transação", async () => {
    const { solicitacao, criada } = await criarSolicitacaoExterna(entrada, usuarioId, chave);

    expect(criada).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        solicitanteId: usuarioId,
        chaveIdempotencia: chave,
        estado: "AGUARDANDO_TRIAGEM",
        protocolo: expect.stringMatching(/^EXT-\d{4}-000001$/),
      }),
    });
    expect(mocks.historicoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ solicitacaoId, tipo: "CRIACAO", autorId: usuarioId }),
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId,
        acao: "CRIAR",
        tabelaAfetada: "solicitacoes_externas_svo",
        registroId: solicitacaoId,
      }),
    });
    expect(solicitacao.protocolo).toBe("EXT-2026-000001");
  });

  it("não grava dados pessoais na auditoria", async () => {
    await criarSolicitacaoExterna(entrada, usuarioId, chave);

    const dadosNovos = JSON.stringify(mocks.auditoriaCreate.mock.calls[0]?.[0]);
    expect(dadosNovos).not.toContain("Maria Souza");
    expect(dadosNovos).not.toContain("79999990000");
  });

  it("reenvio com a mesma chave devolve a existente sem criar de novo", async () => {
    mocks.findUnique.mockResolvedValue({ ...registro, historico: [] });

    const { solicitacao, criada } = await criarSolicitacaoExterna(entrada, usuarioId, chave);

    expect(criada).toBe(false);
    expect(solicitacao.id).toBe(solicitacaoId);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requisição simultânea (violação de unicidade) devolve a existente", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...registro, historico: [] });
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicado", {
        code: "P2002",
        clientVersion: "teste",
      }),
    );

    const { criada } = await criarSolicitacaoExterna(entrada, usuarioId, chave);

    expect(criada).toBe(false);
  });

  it("repassa erros inesperados do banco", async () => {
    mocks.create.mockRejectedValue(new Error("falha de conexão"));

    await expect(criarSolicitacaoExterna(entrada, usuarioId, chave)).rejects.toThrow(
      "falha de conexão",
    );
  });

  it("falha da auditoria impede a criação (nada é devolvido)", async () => {
    mocks.auditoriaCreate.mockRejectedValue(new Error("falha de auditoria"));

    await expect(criarSolicitacaoExterna(entrada, usuarioId, chave)).rejects.toThrow(
      "falha de auditoria",
    );
  });
});

describe("listarSolicitacoesExternas", () => {
  beforeEach(() => {
    mocks.findMany.mockResolvedValue([registro]);
    mocks.count.mockResolvedValue(25);
  });

  it("restringe ao dono, pagina e ordena do mais recente", async () => {
    const resultado = await listarSolicitacoesExternas({ page: 3, pageSize: 10 }, usuarioId);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { solicitanteId: usuarioId },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: 20,
      take: 10,
    });
    expect(mocks.count).toHaveBeenCalledWith({ where: { solicitanteId: usuarioId } });
    expect(resultado.meta).toEqual({ page: 3, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("aplica o filtro de estado sem perder o escopo do dono", async () => {
    await listarSolicitacoesExternas(
      { page: 1, pageSize: 10, estado: "AGUARDANDO_COMPLEMENTACAO" },
      usuarioId,
    );

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { solicitanteId: usuarioId, estado: "AGUARDANDO_COMPLEMENTACAO" },
      }),
    );
  });

  it("devolve só o resumo público", async () => {
    const resultado = await listarSolicitacoesExternas({ page: 1, pageSize: 10 }, usuarioId);

    expect(Object.keys(resultado.data[0] ?? {}).sort()).toEqual([
      "atualizadoEm",
      "criadoEm",
      "id",
      "mensagem",
      "permiteComplementar",
      "protocolo",
      "situacao",
    ]);
  });
});

describe("detalharSolicitacaoExterna", () => {
  it("retorna 404 para solicitação inexistente ou de outra pessoa", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const erro = await erroDe(detalharSolicitacaoExterna(solicitacaoId, usuarioId));

    expect(erro.statusCode).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: solicitacaoId, solicitanteId: usuarioId } }),
    );
  });

  it("devolve o detalhe com os complementos enviados", async () => {
    mocks.findFirst.mockResolvedValue({
      ...registro,
      historico: [{ conteudo: "Ponto de referência: praça.", criadoEm: agora }],
    });

    const detalhe = await detalharSolicitacaoExterna(solicitacaoId, usuarioId);

    expect(detalhe.protocolo).toBe("EXT-2026-000001");
    expect(detalhe.complementos).toEqual([
      { conteudo: "Ponto de referência: praça.", enviadoEm: agora },
    ]);
  });
});

describe("complementarSolicitacaoExterna", () => {
  const input = { complemento: "O ponto de referência é a praça central." };

  beforeEach(() => {
    mocks.findFirst.mockResolvedValue({ id: solicitacaoId, estado: "AGUARDANDO_COMPLEMENTACAO" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({
      ...registro,
      historico: [{ conteudo: input.complemento, criadoEm: agora }],
    });
  });

  it("registra o complemento e devolve a solicitação para a triagem", async () => {
    const resposta = await complementarSolicitacaoExterna(solicitacaoId, input, usuarioId);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: solicitacaoId, solicitanteId: usuarioId, estado: "AGUARDANDO_COMPLEMENTACAO" },
      data: { estado: "AGUARDANDO_TRIAGEM", mensagemParaSolicitante: null },
    });
    expect(mocks.historicoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        solicitacaoId,
        tipo: "COMPLEMENTO",
        conteudo: input.complemento,
        autorId: usuarioId,
      }),
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalledOnce();
    expect(resposta.situacao).toBe("Recebida");
  });

  it("retorna 404 para solicitação de outra pessoa", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect((await erroDe(complementarSolicitacaoExterna(solicitacaoId, input, usuarioId))).statusCode).toBe(
      404,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retorna 422 quando a solicitação não está aguardando complementação", async () => {
    mocks.findFirst.mockResolvedValue({ id: solicitacaoId, estado: "AGUARDANDO_GESTOR" });

    expect((await erroDe(complementarSolicitacaoExterna(solicitacaoId, input, usuarioId))).statusCode).toBe(
      422,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retorna 409 quando outra requisição já alterou o estado", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    expect((await erroDe(complementarSolicitacaoExterna(solicitacaoId, input, usuarioId))).statusCode).toBe(
      409,
    );
    expect(mocks.historicoCreate).not.toHaveBeenCalled();
  });
});