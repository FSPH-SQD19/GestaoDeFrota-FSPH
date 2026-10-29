import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../src/middleware/http_m";

const mocks = vi.hoisted(() => ({
  chamadoCount: vi.fn(),
  chamadoFindMany: vi.fn(),
  chamadoFindUnique: vi.fn(),
  chamadoFindUniqueOrThrow: vi.fn(),
  chamadoCreate: vi.fn(),
  chamadoUpdateMany: vi.fn(),
  ordemCount: vi.fn(),
  ordemFindMany: vi.fn(),
  ordemCreate: vi.fn(),
  ordemUpdate: vi.fn(),
  veiculoCount: vi.fn(),
  veiculoFindMany: vi.fn(),
  veiculoFindUnique: vi.fn(),
  veiculoUpdate: vi.fn(),
  motoristaFindMany: vi.fn(),
  motoristaFindUnique: vi.fn(),
  motoristaUpdate: vi.fn(),
  desinfeccaoCreate: vi.fn(),
  desinfeccaoUpdateMany: vi.fn(),
  auditoriaFindMany: vi.fn(),
  auditoriaCreate: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    chamadoSvo: {
      count: mocks.chamadoCount,
      findMany: mocks.chamadoFindMany,
      findUnique: mocks.chamadoFindUnique,
      findUniqueOrThrow: mocks.chamadoFindUniqueOrThrow,
      create: mocks.chamadoCreate,
      updateMany: mocks.chamadoUpdateMany,
    },
    ordemColetaSvo: {
      count: mocks.ordemCount,
      findMany: mocks.ordemFindMany,
      create: mocks.ordemCreate,
      update: mocks.ordemUpdate,
    },
    veiculo: {
      count: mocks.veiculoCount,
      findMany: mocks.veiculoFindMany,
      findUnique: mocks.veiculoFindUnique,
      update: mocks.veiculoUpdate,
    },
    motorista: {
      findMany: mocks.motoristaFindMany,
      findUnique: mocks.motoristaFindUnique,
      update: mocks.motoristaUpdate,
    },
    desinfeccaoSvo: {
      create: mocks.desinfeccaoCreate,
      updateMany: mocks.desinfeccaoUpdateMany,
    },
    auditoriaSistema: {
      findMany: mocks.auditoriaFindMany,
      create: mocks.auditoriaCreate,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

import {
  concluirColetaSvo,
  concluirDesinfeccaoSvo,
  criarChamadoSchema,
  emitirOrdemColetaSvo,
  indicadoresSvo,
  listarChamadosSchema,
  listarChamadosSvo,
  realizarTriagemSvo,
  registrarChamadoSvo,
  triagemSchema,
} from "../../../src/service/svo_s";

const usuarioId = "00000000-0000-4000-8000-000000000001";
const chamadoId = "00000000-0000-4000-8000-000000000010";
const veiculoId = "00000000-0000-4000-8000-000000000020";
const motoristaId = "00000000-0000-4000-8000-000000000030";

describe("svo_s — schemas e regras do módulo SVO", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: mocks.queryRaw,
        chamadoSvo: {
          findUnique: mocks.chamadoFindUnique,
          findUniqueOrThrow: mocks.chamadoFindUniqueOrThrow,
          create: mocks.chamadoCreate,
          updateMany: mocks.chamadoUpdateMany,
        },
        ordemColetaSvo: {
          count: mocks.ordemCount,
          findMany: mocks.ordemFindMany,
          create: mocks.ordemCreate,
          update: mocks.ordemUpdate,
        },
        veiculo: {
          findUnique: mocks.veiculoFindUnique,
          update: mocks.veiculoUpdate,
        },
        motorista: {
          findUnique: mocks.motoristaFindUnique,
          update: mocks.motoristaUpdate,
        },
        desinfeccaoSvo: {
          create: mocks.desinfeccaoCreate,
          updateMany: mocks.desinfeccaoUpdateMany,
        },
        auditoriaSistema: {
          create: mocks.auditoriaCreate,
        },
      }),
    );
  });

  it("valida schema de criação e exige justificativa ao recusar triagem", () => {
    expect(
      criarChamadoSchema.safeParse({
        nomeFalecido: "José da Silva",
        enderecoOcorrencia: "Rua A, 120, Aracaju",
        relatoOcorrencia: "Óbito domiciliar informado por familiar.",
      }).success,
    ).toBe(true);

    expect(triagemSchema.safeParse({ decisao: "RECUSAR" }).success).toBe(false);
    expect(
      triagemSchema.safeParse({
        decisao: "RECUSAR",
        justificativa: "Encaminhado ao IML por suspeita de causa externa.",
      }).success,
    ).toBe(true);
  });

  it("aplica etapa e busca na listagem paginada e recupera parecer da auditoria", async () => {
    const filtros = listarChamadosSchema.parse({
      etapa: "AGUARDANDO_ORDEM",
      busca: "atalaia",
      page: "2",
      pageSize: "5",
    });

    mocks.chamadoFindMany.mockResolvedValue([
      {
        id: chamadoId,
        numeroProtocolo: "SVO-2026-0007",
        nomeFalecido: "Fulano Teste",
        enderecoOcorrencia: "Bairro Atalaia",
        relatoOcorrencia: "Relato",
        statusTriagem: "APROVADO",
        ordemColeta: null,
      },
    ]);
    mocks.chamadoCount.mockResolvedValue(6);
    mocks.auditoriaFindMany.mockResolvedValue([
      {
        registroId: chamadoId,
        dadosNovos: { justificativa: "Critérios clínicos compatíveis com SVO." },
      },
    ]);

    const resultado = await listarChamadosSvo(filtros);

    expect(mocks.chamadoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      }),
    );
    expect(resultado.meta).toEqual({ page: 2, pageSize: 5, total: 6, totalPages: 2 });
    expect(resultado.data[0]?.justificativaTriagem).toBe("Critérios clínicos compatíveis com SVO.");
  });

  it("gera protocolo sequencial SVO-AAAA-NNNN ao registrar chamado", async () => {
    mocks.queryRaw.mockResolvedValue([{ ultimo_valor: 12 }]);
    mocks.chamadoCreate.mockResolvedValue({
      id: chamadoId,
      numeroProtocolo: "SVO-2026-0012",
      nomeFalecido: "Fulano Teste",
      enderecoOcorrencia: "Centro, Aracaju",
      relatoOcorrencia: "Óbito natural em domicílio.",
      statusTriagem: "EM_ANALISE",
    });

    const criado = await registrarChamadoSvo(
      {
        nomeFalecido: "Fulano Teste",
        enderecoOcorrencia: "Centro, Aracaju",
        relatoOcorrencia: "Óbito natural em domicílio.",
      },
      usuarioId,
      new Date("2026-10-29T15:00:00.000Z"),
    );

    expect(criado.numeroProtocolo).toBe("SVO-2026-0012");
    expect(mocks.auditoriaCreate).toHaveBeenCalledOnce();
  });

  it("realiza triagem atômica e rejeita chamado já triado com 409", async () => {
    mocks.chamadoUpdateMany.mockResolvedValue({ count: 0 });
    mocks.chamadoFindUnique.mockResolvedValue({ id: chamadoId });

    await expect(
      realizarTriagemSvo(chamadoId, { decisao: "APROVAR", justificativa: "Aprovado" }, usuarioId),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("bloqueia alocação de veículo administrativo ou em desinfecção no SVO", async () => {
    mocks.queryRaw.mockResolvedValue([{ id: veiculoId }]);
    mocks.chamadoFindUnique.mockResolvedValue({
      id: chamadoId,
      statusTriagem: "APROVADO",
      ordemColeta: null,
    });
    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      tipoFrota: "SVO",
      ativo: true,
      status: "DESINFECCAO",
      capacidadeMaxima: 4,
    });
    mocks.motoristaFindUnique.mockResolvedValue({
      id: motoristaId,
      ativo: true,
      status: "DISPONIVEL",
      validadeCnh: new Date("2030-12-31T00:00:00.000Z"),
    });
    mocks.ordemFindMany.mockResolvedValue([]);

    await expect(
      emitirOrdemColetaSvo(chamadoId, { veiculoId, motoristaId }, usuarioId),
    ).rejects.toThrow(HttpError);
  });

  it("respeita limite de capacidadeMaxima da viatura SVO", async () => {
    mocks.queryRaw.mockResolvedValue([{ id: veiculoId }]);
    mocks.chamadoFindUnique.mockResolvedValue({
      id: chamadoId,
      statusTriagem: "APROVADO",
      ordemColeta: null,
    });
    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      tipoFrota: "SVO",
      ativo: true,
      status: "EM_VIAGEM",
      capacidadeMaxima: 2,
    });
    mocks.motoristaFindUnique.mockResolvedValue({
      id: motoristaId,
      ativo: true,
      status: "OCUPADO",
      validadeCnh: new Date("2030-12-31T00:00:00.000Z"),
    });
    mocks.ordemFindMany.mockResolvedValue([
      { id: "ord-1", motoristaId },
      { id: "ord-2", motoristaId },
    ]);

    await expect(
      emitirOrdemColetaSvo(chamadoId, { veiculoId, motoristaId }, usuarioId),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "Capacidade máxima da viatura atingida para esta operação.",
    });
  });

  it("coloca viatura em DESINFECCAO ao concluir a última coleta ativa e libera após confirmar desinfecção", async () => {
    mocks.chamadoFindUnique.mockResolvedValue({
      id: chamadoId,
      ordemColeta: {
        id: "ord-1",
        veiculoId,
        motoristaId,
        status: "EM_ANDAMENTO",
      },
    });
    mocks.ordemUpdate.mockResolvedValue({
      id: "ord-1",
      veiculoId,
      motoristaId,
      status: "CONCLUIDA",
    });
    mocks.ordemCount.mockResolvedValue(0);

    await concluirColetaSvo(chamadoId, usuarioId);

    expect(mocks.veiculoUpdate).toHaveBeenCalledWith({
      where: { id: veiculoId },
      data: { status: "DESINFECCAO" },
    });
    expect(mocks.desinfeccaoCreate).toHaveBeenCalledOnce();
    expect(mocks.motoristaUpdate).toHaveBeenCalledWith({
      where: { id: motoristaId },
      data: { status: "DISPONIVEL" },
    });

    mocks.veiculoFindUnique.mockResolvedValue({
      id: veiculoId,
      placa: "QMA4J28",
      modelo: "S10 SVO",
      tipoFrota: "SVO",
      ativo: true,
      status: "DESINFECCAO",
    });
    mocks.veiculoUpdate.mockResolvedValue({
      id: veiculoId,
      placa: "QMA4J28",
      modelo: "S10 SVO",
      status: "DISPONIVEL",
      capacidadeMaxima: 4,
      ativo: true,
    });

    const liberada = await concluirDesinfeccaoSvo(veiculoId, usuarioId);
    expect(liberada.status).toBe("DISPONIVEL");
    expect(mocks.desinfeccaoUpdateMany).toHaveBeenCalledOnce();
  });

  it("retorna indicadores consolidados incluindo coletas ativas e total de viaturas", async () => {
    mocks.chamadoCount
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    mocks.ordemCount.mockResolvedValueOnce(3);
    mocks.veiculoCount.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const ind = await indicadoresSvo();
    expect(ind).toEqual({
      total: 10,
      emAnalise: 3,
      aguardandoOrdem: 2,
      aprovados: 5,
      recusados: 2,
      coletasEmAndamento: 3,
      viaturasDisponiveis: 2,
      totalViaturas: 3,
    });
  });
});
