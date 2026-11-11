import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  vehicle: vi.fn(),
  supplier: vi.fn(),
  lookup: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  trips: vi.fn(),
  reservations: vi.fn(),
  reservation: vi.fn(),
  history: vi.fn(),
}));
const tx = {
  $queryRaw: mocks.query,
  veiculo: { findUnique: mocks.vehicle },
  fornecedor: { findUnique: mocks.supplier },
  solicitacaoViagem: { findMany: mocks.trips },
  manutencao: {
    findUnique: mocks.lookup,
    create: mocks.create,
    update: mocks.update,
    findMany: mocks.reservations,
    findFirst: mocks.reservation,
  },
  auditoriaSistema: { create: mocks.audit },
};
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    manutencao: { findUnique: mocks.lookup },
    auditoriaSistema: { findMany: mocks.history },
  },
}));
import {
  cancelarProgramacao,
  conflitosProgramacao,
  exigirSemReservaPreventiva,
  historicoProgramacoes,
  programarManutencaoSchema,
  salvarProgramacao,
} from "../../../src/service/programacao_manutencao_s";

const id = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-000000000002";
const usuarioId = "00000000-0000-4000-8000-000000000003";
const input = {
  veiculoId,
  inicioPrevisto: new Date("2026-12-01T11:00:00Z"),
  fimPrevisto: new Date("2026-12-01T15:00:00Z"),
  fornecedorId: null,
  descricao: "Revisão preventiva",
};
const registro = { ...input, id, tipo: "PREVENTIVA", status: "PROGRAMADA", versao: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((fn) => fn(tx));
  mocks.query.mockResolvedValue([]);
  mocks.vehicle.mockResolvedValue({ ativo: true });
  mocks.supplier.mockResolvedValue({ ativo: true, tipoServico: "OFICINA" });
  mocks.lookup.mockResolvedValue(registro);
  mocks.create.mockResolvedValue(registro);
  mocks.update.mockResolvedValue({ ...registro, versao: 1 });
  mocks.trips.mockResolvedValue([]);
  mocks.reservations.mockResolvedValue([]);
  mocks.reservation.mockResolvedValue(null);
  mocks.audit.mockResolvedValue({});
  mocks.history.mockResolvedValue([]);
});

describe("programação preventiva", () => {
  it("valida a ordem dos horários e exige fuso explícito", () => {
    const base = {
      ...input,
      inicioPrevisto: input.inicioPrevisto.toISOString(),
      fimPrevisto: input.fimPrevisto.toISOString(),
    };
    expect(programarManutencaoSchema.safeParse(base).success).toBe(true);
    expect(
      programarManutencaoSchema.safeParse({ ...base, fimPrevisto: base.inicioPrevisto }).success,
    ).toBe(false);
    expect(
      programarManutencaoSchema.safeParse({ ...base, inicioPrevisto: "2026-12-01T08:00:00" })
        .success,
    ).toBe(false);
  });
  it("programa com a trava compartilhada e autoria atômica", async () => {
    await salvarProgramacao(input, usuarioId);
    expect(mocks.query.mock.calls[0][1]).toBe(`veiculo:${veiculoId}`);
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.trips.mock.invocationCallOrder[0]!,
    );
    expect(mocks.create).toHaveBeenCalledWith({
      data: { ...input, tipo: "PREVENTIVA", status: "PROGRAMADA" },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId,
        acao: "PROGRAMAR",
        tabelaAfetada: "manutencoes",
        registroId: id,
        dadosNovos: { anterior: null, atual: expect.objectContaining({ status: "PROGRAMADA" }) },
      }),
    });
  });
  it.each(["APROVADA", "EM_TRANSITO"])(
    "impede reserva com viagem %s e informa o protocolo",
    async (status) => {
      mocks.trips.mockResolvedValue([{ id, protocolo: "SV-123", status }]);
      await expect(salvarProgramacao(input, usuarioId)).rejects.toMatchObject({
        statusCode: 409,
        errors: [expect.objectContaining({ mensagem: expect.stringContaining("SV-123") })],
      });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );
  it("rejeita outra reserva preventiva sobreposta", async () => {
    mocks.reservations.mockResolvedValue([{ id: "outra" }]);
    await expect(salvarProgramacao(input, usuarioId)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("usa limites exclusivos e ignora apenas a programação editada", async () => {
    await conflitosProgramacao({ ...input, ignorarId: id }, tx as never);
    expect(mocks.trips).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          veiculoAlocadoId: veiculoId,
          status: { in: ["APROVADA", "EM_TRANSITO"] },
          dataHoraPretendida: { lt: input.fimPrevisto },
          dataHoraRetornoPrevista: { gt: input.inicioPrevisto },
        },
      }),
    );
    expect(mocks.reservations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          veiculoId,
          status: "PROGRAMADA",
          id: { not: id },
          inicioPrevisto: { lt: input.fimPrevisto },
          fimPrevisto: { gt: input.inicioPrevisto },
        },
      }),
    );
  });
  it("reagenda substituindo a janela anterior e registra ambas na auditoria", async () => {
    const novo = {
      ...input,
      inicioPrevisto: new Date("2026-12-02T11:00:00Z"),
      fimPrevisto: new Date("2026-12-02T15:00:00Z"),
    };
    mocks.update.mockResolvedValue({ ...registro, ...novo, versao: 1 });
    await salvarProgramacao(novo, usuarioId, { id, versao: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id },
      data: { ...novo, versao: { increment: 1 } },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: "REAGENDAR",
        dadosNovos: {
          anterior: expect.objectContaining({ inicioPrevisto: input.inicioPrevisto.toISOString() }),
          atual: expect.objectContaining({ inicioPrevisto: novo.inicioPrevisto.toISOString() }),
        },
      }),
    });
  });
  it("preserva a janela anterior quando o reagendamento conflita", async () => {
    mocks.trips.mockResolvedValue([{ id, protocolo: "SV-123", status: "APROVADA" }]);
    await expect(salvarProgramacao(input, usuarioId, { id, versao: 0 })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([
    { status: "CANCELADA", versao: 0 },
    { status: "PROGRAMADA", versao: 1 },
  ])("recusa edição com situação ou versão obsoleta %j", async (mudanca) => {
    mocks.lookup.mockResolvedValue({ ...registro, ...mudanca });
    await expect(salvarProgramacao(input, usuarioId, { id, versao: 0 })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("recusa mudança de veículo durante o reagendamento", async () => {
    await expect(
      salvarProgramacao({ ...input, veiculoId: usuarioId }, usuarioId, { id, versao: 0 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("cancela com trava e auditoria, liberando a reserva pela situação", async () => {
    mocks.update.mockResolvedValue({ ...registro, status: "CANCELADA", versao: 1 });
    const cancelada = await cancelarProgramacao(id, 0, usuarioId);
    expect(cancelada.status).toBe("CANCELADA");
    expect(mocks.query.mock.calls[0][1]).toBe(`veiculo:${veiculoId}`);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "CANCELADA", versao: { increment: 1 } },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: "CANCELAR", usuarioId }),
    });
  });
  it("recusa cancelamento obsoleto sem liberar ou auditar", async () => {
    await expect(cancelarProgramacao(id, 3, usuarioId)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("recusa oficina inativa ou de outro tipo", async () => {
    mocks.supplier.mockResolvedValue({ ativo: true, tipoServico: "LOCADORA" });
    await expect(
      salvarProgramacao({ ...input, fornecedorId: id }, usuarioId),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("não confirma a transação se a auditoria falhar", async () => {
    mocks.audit.mockRejectedValue(new Error("Falha na auditoria"));
    await expect(salvarProgramacao(input, usuarioId)).rejects.toThrow("Falha na auditoria");
    await expect(mocks.transaction.mock.results[0]?.value).rejects.toThrow("Falha na auditoria");
  });
  it("bloqueia alocação de viagem apenas em janelas programadas", async () => {
    mocks.reservation.mockResolvedValue({ id });
    await expect(
      exigirSemReservaPreventiva(tx as never, veiculoId, input.inicioPrevisto, input.fimPrevisto),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.reservation).toHaveBeenCalledWith({
      where: {
        veiculoId,
        status: "PROGRAMADA",
        inicioPrevisto: { lt: input.fimPrevisto },
        fimPrevisto: { gt: input.inicioPrevisto },
      },
      select: { id: true },
    });
  });
  it("retorna a autoria e a cronologia do histórico", async () => {
    mocks.history.mockResolvedValue([
      {
        id: "log",
        registroId: id,
        acao: "REAGENDAR",
        criadoEm: new Date("2026-11-10"),
        dadosNovos: {},
        usuario: { nome: "Gestora" },
      },
    ]);
    const historico = await historicoProgramacoes([id]);
    expect(historico.get(id)).toEqual([
      expect.objectContaining({ autor: "Gestora", acao: "REAGENDAR" }),
    ]);
  });
});
