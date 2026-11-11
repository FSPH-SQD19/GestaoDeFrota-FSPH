import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  vehicles: vi.fn(),
  drivers: vi.fn(),
  trips: vi.fn(),
  maintenance: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    veiculo: { findMany: mocks.vehicles },
    motorista: { findMany: mocks.drivers },
    solicitacaoViagem: { findMany: mocks.trips },
    manutencao: { findMany: mocks.maintenance },
    auditoriaSistema: { findMany: mocks.history },
  },
}));
import { consultarAgenda } from "../../../src/service/agenda_s";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((operacoes) => Promise.all(operacoes));
  mocks.vehicles.mockResolvedValue([]);
  mocks.drivers.mockResolvedValue([]);
  mocks.trips.mockResolvedValue([]);
  mocks.maintenance.mockResolvedValue([]);
  mocks.history.mockResolvedValue([]);
});
describe("programação preventiva na agenda", () => {
  it.each(["PROGRAMADA", "CANCELADA"])(
    "exibe a janela precisa, situação %s e autoria",
    async (status) => {
      mocks.maintenance.mockResolvedValue([
        {
          id: "m1",
          veiculoId: "v1",
          tipo: "PREVENTIVA",
          status,
          descricao: "Revisão",
          dataManutencao: null,
          dataConclusao: null,
          inicioPrevisto: new Date("2026-12-01T11:00:00Z"),
          fimPrevisto: new Date("2026-12-01T15:00:00Z"),
          fornecedor: { razaoSocial: "Oficina Central" },
          veiculo: { id: "v1", placa: "ABC1234", modelo: "Carro" },
        },
      ]);
      mocks.history.mockResolvedValue([
        {
          id: "a1",
          registroId: "m1",
          acao: "PROGRAMAR",
          criadoEm: new Date("2026-11-10"),
          usuario: { nome: "Gestora" },
          dadosNovos: null,
        },
      ]);
      const agenda = await consultarAgenda({ inicio: "2026-12-01", fim: "2026-12-01" });
      expect(agenda.ocupacoes).toEqual([
        expect.objectContaining({
          id: "m1",
          inicio: new Date("2026-12-01T11:00:00Z"),
          fim: new Date("2026-12-01T15:00:00Z"),
          status,
          bloqueia: status === "PROGRAMADA",
          oficina: "Oficina Central",
          historico: [expect.objectContaining({ autor: "Gestora" })],
        }),
      ]);
      expect(agenda.veiculos).toEqual([expect.objectContaining({ id: "v1" })]);
    },
  );
  it("preserva a exibição de preventiva antiga sem janela", async () => {
    mocks.maintenance.mockResolvedValue([
      {
        id: "antiga",
        veiculoId: "v1",
        tipo: "PREVENTIVA",
        status: "CONCLUIDA",
        descricao: null,
        dataManutencao: new Date("2026-12-01"),
        dataConclusao: new Date("2026-12-01"),
        inicioPrevisto: null,
        fimPrevisto: null,
        fornecedor: null,
        veiculo: { id: "v1", placa: "ABC1234", modelo: "Carro" },
      },
    ]);
    const agenda = await consultarAgenda({ inicio: "2026-12-01", fim: "2026-12-01" });
    expect(agenda.ocupacoes).toEqual([
      expect.objectContaining({
        id: "antiga",
        inicio: new Date("2026-12-01T03:00:00Z"),
        fim: new Date("2026-12-02T03:00:00Z"),
      }),
    ]);
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
