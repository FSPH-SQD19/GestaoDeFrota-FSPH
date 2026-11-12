import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  avariaFindMany: vi.fn(),
  avariaFindUnique: vi.fn(),
  avariaCount: vi.fn(),
  avariaUpdate: vi.fn(),
  vehicleList: vi.fn(),
  vehicleFindUnique: vi.fn(),
  vehicleUpdateMany: vi.fn(),
  historyFindMany: vi.fn(),
  historyCreate: vi.fn(),
  maintenanceCount: vi.fn(),
  maintenanceCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

const tx = {
  $queryRaw: mocks.queryRaw,
  avariaViagem: {
    findUnique: mocks.avariaFindUnique,
    update: mocks.avariaUpdate,
    count: mocks.avariaCount,
  },
  avariaHistorico: { create: mocks.historyCreate },
  veiculo: { findUnique: mocks.vehicleFindUnique, updateMany: mocks.vehicleUpdateMany },
  manutencao: { count: mocks.maintenanceCount, create: mocks.maintenanceCreate },
  auditoriaSistema: { create: mocks.auditCreate },
};

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    avariaViagem: {
      findMany: mocks.avariaFindMany,
      findUnique: mocks.avariaFindUnique,
      count: mocks.avariaCount,
    },
    avariaHistorico: { findMany: mocks.historyFindMany },
    veiculo: { findMany: mocks.vehicleList },
  },
}));

import {
  analisarAvaria,
  analisarAvariaSchema,
  listarAvarias,
  listarAvariasSchema,
} from "../../../src/service/avaria_s";

const id = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-000000000002";
const usuarioId = "00000000-0000-4000-8000-000000000003";
const registro = {
  id,
  solicitacaoId: "00000000-0000-4000-8000-000000000004",
  execucaoId: "00000000-0000-4000-8000-000000000005",
  veiculoId,
  descricao: "Avaria na porta lateral",
  situacao: "PENDENTE",
  justificativa: null,
  solicitacao: { protocolo: "V-2026-001" },
  execucao: { kmFinal: new Prisma.Decimal(120) },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((operacao) => operacao(tx));
  mocks.queryRaw.mockResolvedValue([]);
  mocks.avariaFindUnique.mockResolvedValue({ veiculoId });
  mocks.avariaFindMany.mockResolvedValue([]);
  mocks.avariaCount.mockResolvedValue(0);
  mocks.avariaUpdate.mockImplementation(async ({ data }) => ({ ...registro, ...data }));
  mocks.vehicleList.mockResolvedValue([]);
  mocks.vehicleFindUnique.mockResolvedValue({
    id: veiculoId,
    ativo: true,
    placa: "ABC1234",
    status: "MANUTENCAO",
    odometroAtual: new Prisma.Decimal(120),
  });
  mocks.vehicleUpdateMany.mockResolvedValue({ count: 1 });
  mocks.historyFindMany.mockResolvedValue([]);
  mocks.historyCreate.mockResolvedValue({});
  mocks.maintenanceCount.mockResolvedValue(0);
  mocks.maintenanceCreate.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000006",
    tipo: "CORRETIVA",
    status: "ABERTA",
    descricao: "Avaria ligada à viagem.",
  });
  mocks.auditCreate.mockResolvedValue({});
});

describe("avarias de viagem", () => {
  it("valida filtros e obriga justificativa de análise", () => {
    expect(listarAvariasSchema.safeParse({ page: "1", pageSize: "20" }).success).toBe(true);
    expect(listarAvariasSchema.safeParse({ situacao: "INVALIDA" }).success).toBe(false);
    expect(
      analisarAvariaSchema.safeParse({ decisao: "LIBERAR", justificativa: "ok" }).success,
    ).toBe(false);
  });

  it("lista avarias paginadas com filtro de situação e veículo", async () => {
    mocks.avariaFindMany.mockResolvedValue([registro]);
    mocks.avariaCount.mockResolvedValue(1);
    const filtros = listarAvariasSchema.parse({
      page: 1,
      pageSize: 10,
      veiculoId,
      situacao: "PENDENTE",
    });

    await expect(listarAvarias(filtros)).resolves.toMatchObject({
      data: [registro],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(mocks.avariaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { veiculoId, situacao: "PENDENTE" }, skip: 0, take: 10 }),
    );
  });

  it("libera o veículo somente após a última pendência e registra a decisão", async () => {
    mocks.avariaFindUnique.mockResolvedValueOnce({ veiculoId }).mockResolvedValueOnce(registro);

    const resposta = await analisarAvaria(
      id,
      { decisao: "LIBERAR", justificativa: "Vistoria concluiu que está seguro." },
      usuarioId,
    );

    expect(resposta.situacao).toBe("LIBERADA");
    expect(mocks.vehicleUpdateMany).toHaveBeenCalledWith({
      where: { id: veiculoId, ativo: true, status: "MANUTENCAO" },
      data: { status: "DISPONIVEL" },
    });
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        avariaId: id,
        autorId: usuarioId,
        situacaoAnterior: "PENDENTE",
        situacaoNova: "LIBERADA",
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acao: "LIBERADA",
          tabelaAfetada: "avarias_viagem",
          registroId: id,
        }),
      }),
    );
  });

  it("cria manutenção corretiva vinculada e mantém o veículo bloqueado", async () => {
    mocks.avariaFindUnique.mockResolvedValueOnce({ veiculoId }).mockResolvedValueOnce(registro);

    const resposta = await analisarAvaria(
      id,
      { decisao: "ENCAMINHAR_MANUTENCAO", justificativa: "Reparo necessário antes de liberar." },
      usuarioId,
    );

    expect(mocks.maintenanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          veiculoId,
          avariaId: id,
          tipo: "CORRETIVA",
          status: "ABERTA",
          odometroRegistro: new Prisma.Decimal(120),
        }),
      }),
    );
    expect(mocks.vehicleUpdateMany).toHaveBeenCalledWith({
      where: { id: veiculoId, status: { not: "MANUTENCAO" } },
      data: { status: "MANUTENCAO" },
    });
    expect(resposta).toMatchObject({
      situacao: "ENCAMINHADA_MANUTENCAO",
      manutencao: { status: "ABERTA" },
    });
  });

  it("recusa liberação quando há outra avaria pendente ou manutenção aberta", async () => {
    mocks.avariaFindUnique.mockResolvedValueOnce({ veiculoId }).mockResolvedValueOnce(registro);
    mocks.avariaCount.mockResolvedValueOnce(1);

    await expect(
      analisarAvaria(
        id,
        { decisao: "LIBERAR", justificativa: "Vistoria concluiu que está seguro." },
        usuarioId,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.vehicleUpdateMany).not.toHaveBeenCalled();
    expect(mocks.avariaUpdate).not.toHaveBeenCalled();
  });
});
