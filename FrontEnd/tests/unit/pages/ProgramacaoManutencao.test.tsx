import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import { ProgramacaoManutencao } from "../../../src/pages/veiculos/ProgramacaoManutencao";
vi.mock("../../../src/lib/api", async (original) => ({
  ...(await original<typeof import("../../../src/lib/api")>()),
  apiRequest: vi.fn(),
}));
const item = {
  id: "m1",
  veiculoId: "v1",
  inicioPrevisto: "2026-12-01T11:00:00Z",
  fimPrevisto: "2026-12-01T15:00:00Z",
  fornecedorId: null,
  fornecedor: null,
  descricao: "Revisão",
  status: "PROGRAMADA",
  versao: 0,
  historico: [
    {
      id: "a1",
      acao: "PROGRAMAR",
      criadoEm: "2026-11-10T12:00:00Z",
      autor: "Gestora",
      dados: {
        anterior: null,
        atual: { inicioPrevisto: "2026-12-01T11:00:00Z", fimPrevisto: "2026-12-01T15:00:00Z" },
      },
    },
  ],
};
let viagens: unknown[], manutencoes: unknown[];
beforeEach(() => {
  viagens = [];
  manutencoes = [];
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path === "/fornecedores") return { dados: [] };
      if (path.includes("/programacoes?"))
        return { data: [item], meta: { total: 1, totalPages: 1 } };
      if (path.endsWith("/conflitos")) return { viagens, manutencoes };
      if (options?.method === "POST" || options?.method === "PATCH") return {};
      throw new Error("Consulta inesperada");
    });
});
function preencher() {
  fireEvent.change(screen.getByLabelText(/^Início/), { target: { value: "2026-12-02T08:00" } });
  fireEvent.change(screen.getByLabelText(/^Fim/), { target: { value: "2026-12-02T12:00" } });
}
describe("programação preventiva na interface", () => {
  it("lista os protocolos conflitantes e impede a confirmação", async () => {
    viagens = [
      {
        id: "s1",
        protocolo: "SV-123",
        status: "EM_TRANSITO",
        dataHoraPretendida: item.inicioPrevisto,
        dataHoraRetornoPrevista: item.fimPrevisto,
      },
    ];
    render(<ProgramacaoManutencao veiculoId="v1" />);
    preencher();
    expect(await screen.findByText(/SV-123/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar programação" })).toBeDisabled();
  });
  it("confirma sem oficina, converte o horário de Brasília e atualiza a ocupação", async () => {
    const atualizado = vi.fn();
    window.addEventListener("frota:ocupacao-atualizada", atualizado);
    try {
      render(<ProgramacaoManutencao veiculoId="v1" />);
      preencher();
      const confirmar = screen.getByRole("button", { name: "Confirmar programação" });
      await waitFor(() => expect(confirmar).toBeEnabled());
      await userEvent.click(confirmar);
      expect(await screen.findByText("Manutenção programada.")).toBeInTheDocument();
      expect(apiRequest).toHaveBeenCalledWith("/manutencoes/programacoes", {
        method: "POST",
        data: {
          veiculoId: "v1",
          inicioPrevisto: "2026-12-02T11:00:00.000Z",
          fimPrevisto: "2026-12-02T15:00:00.000Z",
          fornecedorId: null,
          descricao: null,
        },
      });
      expect(atualizado).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("frota:ocupacao-atualizada", atualizado);
    }
  });
  it("reagenda a reserva existente e envia sua versão, sem criar outra", async () => {
    render(<ProgramacaoManutencao veiculoId="v1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Reagendar" }));
    preencher();
    const confirmar = screen.getByRole("button", { name: "Confirmar reagendamento" });
    await waitFor(() => expect(confirmar).toBeEnabled());
    await userEvent.click(confirmar);
    expect(await screen.findByText("Manutenção reagendada.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/manutencoes/m1/reagendar", {
      method: "PATCH",
      data: expect.objectContaining({ versao: 0, inicioPrevisto: "2026-12-02T11:00:00.000Z" }),
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/manutencoes/programacoes/conflitos",
      expect.objectContaining({
        data: expect.objectContaining({ ignorarId: "m1" }),
      }),
    );
  });
  it("cancela a reserva e exibe a autoria do histórico", async () => {
    render(<ProgramacaoManutencao veiculoId="v1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar programação" }));
    expect(
      await screen.findByText("Programação cancelada. O período foi liberado."),
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/manutencoes/m1/cancelar", {
      method: "PATCH",
      data: { versao: 0 },
    });
    expect(screen.getByText(/Programada por Gestora/)).toBeInTheDocument();
  });
});
