import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecaoMultasMotorista } from "../../../src/pages/motorista/SecaoMultasMotorista";
import * as multasService from "../../../src/services/multasService";

vi.mock("../../../src/services/multasService", () => ({
  obterMultasMotoristaApi: vi.fn(),
  atualizarMultaApi: vi.fn(),
}));

const motoristaId = "00000000-0000-4000-8000-000000000001";

const dadosMock = {
  totalMultas: 2,
  totalPontos: 12,
  valorTotal: 390.46,
  multas: [
    {
      id: "multa-1",
      autoInfracao: "SE-998877",
      veiculoId: "veic-1",
      dataHora: "2026-11-04T10:00:00Z",
      gravidade: "MEDIA" as const,
      pontos: 4,
      valor: 195.23,
      status: "PENDENTE" as const,
      veiculo: { id: "veic-1", placa: "XYZ1234", modelo: "Spin" },
    },
    {
      id: "multa-2",
      autoInfracao: "SE-112233",
      veiculoId: "veic-1",
      dataHora: "2026-11-01T14:00:00Z",
      gravidade: "GRAVE" as const,
      pontos: 8,
      valor: 195.23,
      status: "PAGA" as const,
      veiculo: { id: "veic-1", placa: "XYZ1234", modelo: "Spin" },
    },
  ],
};

describe("SecaoMultasMotorista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza histórico de multas e badge de atenção", async () => {
    vi.mocked(multasService.obterMultasMotoristaApi).mockResolvedValue(dadosMock);

    render(<SecaoMultasMotorista motoristaId={motoristaId} />);

    expect(screen.getByText(/Carregando histórico de infrações/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12 pts")).toBeInTheDocument();
    });

    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("2 auto(s)")).toBeInTheDocument();
    expect(screen.getByText("SE-998877")).toBeInTheDocument();
    expect(screen.getByText("SE-112233")).toBeInTheDocument();
  });

  it("permite quitar uma multa pendente", async () => {
    vi.mocked(multasService.obterMultasMotoristaApi).mockResolvedValue(dadosMock);
    vi.mocked(multasService.atualizarMultaApi).mockResolvedValue({
      ...dadosMock.multas[0],
      status: "PAGA",
    });

    render(<SecaoMultasMotorista motoristaId={motoristaId} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Quitar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Quitar/i }));

    await waitFor(() => {
      expect(multasService.atualizarMultaApi).toHaveBeenCalledWith("multa-1", {
        status: "PAGA",
        dataPagamento: expect.any(String),
      });
    });
  });
});
