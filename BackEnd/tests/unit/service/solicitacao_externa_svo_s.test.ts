import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  historicoCreate: vi.fn(),
  auditoriaCreate: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    solicitacaoExternaSvo: {
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
    solicitacaoExternaSvoHistorico: {
      create: mocks.historicoCreate,
    },
    auditoriaSistema: {
      create: mocks.auditoriaCreate,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        solicitacaoExternaSvo: {
          findUnique: mocks.findUnique,
          findUniqueOrThrow: mocks.findUniqueOrThrow,
          create: mocks.create,
          updateMany: mocks.updateMany,
        },
        solicitacaoExternaSvoHistorico: {
          create: mocks.historicoCreate,
        },
        notificacao: { create: vi.fn() },
        auditoriaSistema: {
          create: mocks.auditoriaCreate,
        },
        $queryRaw: mocks.queryRaw,
      }),
    ),
  },
}));

import {
  criarSolicitacaoExternaSvoModelada,
  criarSolicitacaoExternaSvoSchema,
  obterTransicoesPermitidasSolicitacaoExterna,
  podeTransicionarSolicitacaoExterna,
  serializarSolicitacaoExternaInterna,
  serializarSolicitacaoExternaPublica,
  transicionarSolicitacaoExternaSvo,
  validarTransicaoStatusSolicitacaoExterna,
  type SolicitacaoExternaSvoCompleta,
} from "../../../src/service/solicitacao_externa_svo_s";

const agoraFixo = new Date("2026-11-17T12:00:00.000Z");

const usuarioExterno = {
  id: "00000000-0000-4000-8000-000000000101",
  nome: "Hospital Regional de Sergipe",
  email: "nir@hospital.se.gov.br",
  perfis: ["EXTERNO"],
};

const outroUsuarioExterno = {
  id: "00000000-0000-4000-8000-000000000102",
  nome: "Outro Solicitante Externo",
  email: "outro@externo.test",
  perfis: ["EXTERNO"],
};

const usuarioAtendenteSvo = {
  id: "00000000-0000-4000-8000-000000000201",
  nome: "Atendente SVO",
  email: "svo@fsph.se.gov.br",
  perfis: ["SVO"],
};

const usuarioGestor = {
  id: "00000000-0000-4000-8000-000000000301",
  nome: "Gestor SVO",
  email: "gestor@fsph.se.gov.br",
  perfis: ["GESTOR"],
};

function criarRegistroMock(
  overrides: Partial<SolicitacaoExternaSvoCompleta> = {},
): SolicitacaoExternaSvoCompleta {
  return {
    id: "00000000-0000-4000-8000-000000000901",
    protocolo: "SVOE-2026-0001",
    solicitanteId: usuarioExterno.id,
    nomeContato: "Dr. Carlos Plantonista",
    telefoneContato: "(79) 99999-1234",
    contatoEmail: null,
    tipoSolicitante: "HOSPITAL_UPA",
    instituicaoSolicitante: "Hospital Regional",
    nomeFalecido: "Paciente Inicial Teste",
    enderecoOcorrencia: "Av. Tancredo Neves, 1000, Aracaju/SE",
    municipioOcorrencia: "Aracaju",
    pontoReferencia: "Bloco B",
    relatoOcorrencia: "Óbito natural sem causa definida constatado no plantão.",
    complementacaoSolicitada: null,
    complementacaoEnviada: null,
    status: "AGUARDANDO_TRIAGEM",
    atendenteTriagemId: null,
    triadaEm: null,
    observacaoTriagem: null,
    gestorDecisaoId: null,
    decididaEm: null,
    chaveIdempotenciaDecisao: null,
    justificativaDecisao: null,
    motivoRecusa: null,
    chamadoSvoId: null,
    chaveIdempotencia: "idem-key-12345678",
    versao: 0,
    criadoEm: agoraFixo,
    atualizadoEm: agoraFixo,
    solicitante: {
      id: usuarioExterno.id,
      nome: usuarioExterno.nome,
      email: usuarioExterno.email,
      telefone: "(79) 99999-1234",
    },
    atendenteTriagem: null,
    gestorDecisao: null,
    chamadoSvo: null,
    historico: [
      {
        id: "00000000-0000-4000-8000-000000000991",
        solicitacaoExternaId: "00000000-0000-4000-8000-000000000901",
        autorId: usuarioExterno.id,
        perfilAutor: "EXTERNO",
        acao: "SOLICITACAO_CRIADA",
        statusAnterior: null,
        statusNovo: "AGUARDANDO_TRIAGEM",
        mensagemPublica: "Solicitação recebida e aguardando análise da equipe de triagem do SVO.",
        observacaoInterna: "Anotação restrita à equipe interna",
        criadoEm: agoraFixo,
      },
    ],
    ...overrides,
  };
}

describe("S19FROTA-279 — Modelagem, estados, protocolo e auditoria de Solicitação Externa SVO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ ultimo_valor: 1 }]);
    mocks.auditoriaCreate.mockResolvedValue({});
    mocks.historicoCreate.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  describe("máquina de estados e permissões de transição", () => {
    it("especifica transições válidas a partir de cada estado", () => {
      expect(obterTransicoesPermitidasSolicitacaoExterna("AGUARDANDO_TRIAGEM")).toEqual([
        "AGUARDANDO_COMPLEMENTACAO",
        "AGUARDANDO_GESTOR",
        "RECUSADA",
      ]);
      expect(obterTransicoesPermitidasSolicitacaoExterna("AGUARDANDO_COMPLEMENTACAO")).toEqual([
        "AGUARDANDO_TRIAGEM",
        "RECUSADA",
      ]);
      expect(obterTransicoesPermitidasSolicitacaoExterna("AGUARDANDO_GESTOR")).toEqual([
        "APROVADA",
        "RECUSADA",
      ]);
      expect(obterTransicoesPermitidasSolicitacaoExterna("APROVADA")).toEqual([]);
      expect(obterTransicoesPermitidasSolicitacaoExterna("RECUSADA")).toEqual([]);
      expect(podeTransicionarSolicitacaoExterna("AGUARDANDO_TRIAGEM", "APROVADA")).toBe(false);
    });

    it("impede que atendente aprove no papel do gestor e que gestor decida item não triado", () => {
      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("AGUARDANDO_TRIAGEM", "APROVADA", ["SVO"]),
      ).toThrow("Transição de status inválida de AGUARDANDO_TRIAGEM para APROVADA.");

      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("AGUARDANDO_GESTOR", "APROVADA", ["SVO"]),
      ).toThrow("Apenas o gestor pode aprovar ou recusar solicitações externas já triadas.");

      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("AGUARDANDO_TRIAGEM", "AGUARDANDO_GESTOR", [
          "GESTOR",
        ]),
      ).toThrow(
        "Apenas a equipe de triagem do SVO pode avaliar ou encaminhar solicitações nesta etapa.",
      );
    });

    it("impede que EXTERNO aprove, encaminhe ou recuse solicitações", () => {
      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("AGUARDANDO_TRIAGEM", "AGUARDANDO_GESTOR", [
          "EXTERNO",
        ]),
      ).toThrow(
        "Apenas a equipe de triagem do SVO pode avaliar ou encaminhar solicitações nesta etapa.",
      );

      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("AGUARDANDO_GESTOR", "APROVADA", ["EXTERNO"]),
      ).toThrow("Apenas o gestor pode aprovar ou recusar solicitações externas já triadas.");
    });

    it("bloqueia qualquer transição a partir dos estados terminais APROVADA e RECUSADA", () => {
      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("APROVADA", "RECUSADA", ["ADMIN"]),
      ).toThrow("A solicitação externa já se encontra encerrada com status APROVADA.");

      expect(() =>
        validarTransicaoStatusSolicitacaoExterna("RECUSADA", "AGUARDANDO_TRIAGEM", ["ADMIN"]),
      ).toThrow("A solicitação externa já se encontra encerrada com status RECUSADA.");
    });
  });

  describe("validação LGPD e criação idempotente com protocolo e auditoria", () => {
    it("rejeita campos extras ou excessivos de saúde não previstos no contrato mínimo (.strict)", () => {
      const resultado = criarSolicitacaoExternaSvoSchema.safeParse({
        nomeContato: "Maria",
        telefoneContato: "79999991111",
        nomeFalecido: "João",
        enderecoOcorrencia: "Rua A, 123",
        relatoOcorrencia: "Falecimento em domicílio sem assistência médica.",
        prontuarioMedicoCompleto: "Dados clínicos excessivos vedados pela LGPD",
      });
      expect(resultado.success).toBe(false);
    });

    it("gera protocolo SVOE-2026-0001, grava histórico inicial imutável e registra auditoria", async () => {
      const registroMock = criarRegistroMock();
      mocks.findUnique.mockResolvedValueOnce(null);
      mocks.create.mockResolvedValueOnce(registroMock);

      const resultado = await criarSolicitacaoExternaSvoModelada(
        {
          nomeContato: "Dr. Carlos Plantonista",
          telefoneContato: "79999991234",
          tipoSolicitante: "HOSPITAL_UPA",
          instituicaoSolicitante: "Hospital Regional",
          nomeFalecido: "Paciente Inicial Teste",
          enderecoOcorrencia: "Av. Tancredo Neves, 1000, Aracaju/SE",
          municipioOcorrencia: "Aracaju",
          pontoReferencia: "Bloco B",
          relatoOcorrencia: "Óbito natural sem causa definida constatado no plantão.",
          chaveIdempotencia: "idem-key-12345678",
        },
        usuarioExterno,
        agoraFixo,
      );

      expect(resultado.criadaAgora).toBe(true);
      expect(resultado.solicitacao.protocolo).toBe("SVOE-2026-0001");
      expect(resultado.solicitacao.status).toBe("AGUARDANDO_TRIAGEM");
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.auditoriaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuarioId: usuarioExterno.id,
            acao: "CRIAR",
            tabelaAfetada: "solicitacoes_externas_svo",
            registroId: registroMock.id,
          }),
        }),
      );
      // Garante que observação interna nunca vaza na visão pública
      expect(resultado.solicitacao.historico[0]).not.toHaveProperty("observacaoInterna");
      expect(resultado.solicitacao.historico[0]).not.toHaveProperty("autorId");
    });

    it("garante idempotência no reenvio pelo mesmo solicitante e bloqueia reuso por terceiro", async () => {
      const existente = criarRegistroMock();
      mocks.findUnique.mockResolvedValueOnce(existente);

      const reenvio = await criarSolicitacaoExternaSvoModelada(
        {
          nomeContato: "Dr. Carlos Plantonista",
          telefoneContato: "79999991234",
          nomeFalecido: "Paciente Inicial Teste",
          enderecoOcorrencia: "Av. Tancredo Neves, 1000, Aracaju/SE",
          relatoOcorrencia: "Óbito natural sem causa definida constatado no plantão.",
          chaveIdempotencia: "idem-key-12345678",
        },
        usuarioExterno,
        agoraFixo,
      );

      expect(reenvio.criadaAgora).toBe(false);
      expect(reenvio.solicitacao.protocolo).toBe("SVOE-2026-0001");
      expect(mocks.create).not.toHaveBeenCalled();

      mocks.findUnique.mockResolvedValueOnce(existente);
      await expect(
        criarSolicitacaoExternaSvoModelada(
          {
            nomeContato: "Outro",
            telefoneContato: "79988887777",
            nomeFalecido: "Paciente",
            enderecoOcorrencia: "Rua B, 200",
            relatoOcorrencia: "Relato válido com mais de dez caracteres.",
            chaveIdempotencia: "idem-key-12345678",
          },
          outroUsuarioExterno,
          agoraFixo,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Chave de idempotência já utilizada em outra solicitação.",
      });
    });
  });

  describe("fluxo completo de transições, complementação, concorrência e vínculo com ChamadoSvo", () => {
    it("percorre AGUARDANDO_TRIAGEM -> AGUARDANDO_COMPLEMENTACAO -> AGUARDANDO_TRIAGEM -> AGUARDANDO_GESTOR -> APROVADA", async () => {
      const id = "00000000-0000-4000-8000-000000000901";
      const chamadoId = "00000000-0000-4000-8000-000000000999";

      // 1. Atendente solicita complementação
      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_TRIAGEM", versao: 0 }),
      );
      mocks.findUniqueOrThrow.mockResolvedValueOnce(
        criarRegistroMock({
          status: "AGUARDANDO_COMPLEMENTACAO",
          complementacaoSolicitada: "Informar número do prontuário ou documento de identificação.",
          atendenteTriagemId: usuarioAtendenteSvo.id,
          observacaoTriagem: "Triagem interna: faltou documento.",
          versao: 1,
        }),
      );

      const aposPedidoComplemento = await transicionarSolicitacaoExternaSvo(
        {
          solicitacaoId: id,
          statusNovo: "AGUARDANDO_COMPLEMENTACAO",
          complementacaoSolicitada: "Informar número do prontuário ou documento de identificação.",
          observacaoTriagem: "Triagem interna: faltou documento.",
        },
        usuarioAtendenteSvo,
        agoraFixo,
      );
      expect(aposPedidoComplemento.status).toBe("AGUARDANDO_COMPLEMENTACAO");

      // 2. Solicitante externo envia complementação
      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({
          status: "AGUARDANDO_COMPLEMENTACAO",
          complementacaoSolicitada: "Informar número do prontuário ou documento de identificação.",
          versao: 1,
        }),
      );
      mocks.findUniqueOrThrow.mockResolvedValueOnce(
        criarRegistroMock({
          status: "AGUARDANDO_TRIAGEM",
          complementacaoEnviada: "RG confirmado na recepção e médico assistente identificado.",
          versao: 2,
        }),
      );

      const aposEnvioComplemento = await transicionarSolicitacaoExternaSvo(
        {
          solicitacaoId: id,
          statusNovo: "AGUARDANDO_TRIAGEM",
          complementacaoEnviada: "RG confirmado na recepção e médico assistente identificado.",
        },
        usuarioExterno,
        agoraFixo,
      );
      expect(aposEnvioComplemento.status).toBe("AGUARDANDO_TRIAGEM");
      expect(aposEnvioComplemento).not.toHaveProperty("observacaoTriagem");

      // 3. Atendente encaminha ao gestor
      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_TRIAGEM", versao: 2 }),
      );
      mocks.findUniqueOrThrow.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_GESTOR", versao: 3 }),
      );

      const aposEncaminhamento = await transicionarSolicitacaoExternaSvo(
        {
          solicitacaoId: id,
          statusNovo: "AGUARDANDO_GESTOR",
          observacaoTriagem: "Dados conferidos, apto para deliberação do gestor.",
        },
        usuarioAtendenteSvo,
        agoraFixo,
      );
      expect(aposEncaminhamento.status).toBe("AGUARDANDO_GESTOR");

      // 4. Gestor aprova e vincula ChamadoSvo
      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_GESTOR", versao: 3 }),
      );
      mocks.findUniqueOrThrow.mockResolvedValueOnce(
        criarRegistroMock({
          status: "APROVADA",
          chamadoSvoId: chamadoId,
          chamadoSvo: {
            id: chamadoId,
            numeroProtocolo: "SVO-2026-0042",
            statusTriagem: "APROVADO",
          },
          versao: 4,
        }),
      );

      const aprovada = await transicionarSolicitacaoExternaSvo(
        {
          solicitacaoId: id,
          statusNovo: "APROVADA",
          justificativaDecisao: "Aprovado para despacho imediato da equipe SVO.",
          chamadoSvoId: chamadoId,
        },
        usuarioGestor,
        agoraFixo,
      );

      expect(aprovada.status).toBe("APROVADA");
      expect(aprovada).toHaveProperty("protocoloChamadoSvo", "SVO-2026-0042");
      expect(mocks.historicoCreate).toHaveBeenCalledTimes(4);
      expect(mocks.auditoriaCreate).toHaveBeenCalledTimes(4);
    });

    it("impede que um usuário EXTERNO complemente solicitação de outro proprietário (isolamento horizontal)", async () => {
      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_COMPLEMENTACAO" }),
      );

      await expect(
        transicionarSolicitacaoExternaSvo(
          {
            solicitacaoId: "00000000-0000-4000-8000-000000000901",
            statusNovo: "AGUARDANDO_TRIAGEM",
            complementacaoEnviada: "Tentativa indevida de terceiro.",
          },
          outroUsuarioExterno,
          agoraFixo,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Você não tem permissão para acessar ou alterar esta solicitação.",
      });
    });

    it("protege contra dupla aprovação ou conflito de concorrência otimista", async () => {
      const id = "00000000-0000-4000-8000-000000000901";

      mocks.findUnique.mockResolvedValueOnce(
        criarRegistroMock({ status: "AGUARDANDO_GESTOR", versao: 2 }),
      );
      mocks.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        transicionarSolicitacaoExternaSvo(
          {
            solicitacaoId: id,
            statusNovo: "APROVADA",
            justificativaDecisao: "Aprovação concorrente",
          },
          usuarioGestor,
          agoraFixo,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Conflito de concorrência ao atualizar a solicitação externa. Tente novamente.",
      });
    });

    it("separa visão pública (sem dados internos) da visão interna", () => {
      const completo = criarRegistroMock({
        observacaoTriagem: "Detalhe interno sigiloso da triagem",
        justificativaDecisao: "Deliberação interna do gestor",
      });

      const publica = serializarSolicitacaoExternaPublica(completo);
      const interna = serializarSolicitacaoExternaInterna(completo);

      expect(publica).not.toHaveProperty("observacaoTriagem");
      expect(publica).not.toHaveProperty("justificativaDecisao");
      expect(publica).not.toHaveProperty("solicitante");
      expect(publica.historico[0]).not.toHaveProperty("observacaoInterna");
      expect(publica).not.toHaveProperty("nomeFalecido");
      expect(publica).not.toHaveProperty("telefoneContato");
      expect(publica).not.toHaveProperty("motivoRecusa");

      expect(interna.observacaoTriagem).toBe("Detalhe interno sigiloso da triagem");
      expect(interna.historico[0].observacaoInterna).toBe("Anotação restrita à equipe interna");
    });
  });
});
