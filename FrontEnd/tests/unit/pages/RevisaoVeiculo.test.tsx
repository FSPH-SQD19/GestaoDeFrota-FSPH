import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import { IndicadorRevisao } from "../../../src/pages/veiculos/IndicadorRevisao";
import { RevisaoVeiculo } from "../../../src/pages/veiculos/RevisaoVeiculo";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue({});
});

describe("indicador de revisão", () => {
  it.each([
    [8999.99, "Revisão em dia"],
    [9000, "Próxima da revisão"],
    [9999.99, "Próxima da revisão"],
    [10000, "Revisão necessária"],
    [12000, "Revisão necessária"],
  ])("mostra o estado correto para %s km", (odometroAtual, situacao) => {
    render(<IndicadorRevisao odometroAtual={odometroAtual} kmProximaRevisao={10000} />);
    expect(screen.getByText(situacao)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(Math.min(100, (odometroAtual / 10000) * 100)),
    );
  });
  it("trata veículos antigos sem configuração", () => {
    render(<IndicadorRevisao odometroAtual={50000} kmProximaRevisao={null} />);
    expect(screen.getByText("Próxima revisão ainda não configurada.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("limita a barra a 100% e mantém o percentual real no texto", () => {
    render(<IndicadorRevisao odometroAtual={12000} kmProximaRevisao={10000} />);
    expect(screen.getByText("120%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
describe("configuração da próxima revisão", () => {
  it("salva a leitura absoluta e permite remover o limite com campo vazio", async () => {
    const atualizado = vi.fn();
    const user = userEvent.setup();
    render(
      <RevisaoVeiculo
        veiculoId="v1"
        odometroAtual={9000}
        kmProximaRevisao={10000}
        onAtualizado={atualizado}
      />,
    );
    fireEvent.change(screen.getByLabelText("Próxima revisão (km)"), {
      target: { value: "20000.25" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar revisão" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Quilometragem da próxima revisão atualizada.",
    );
    expect(apiRequest).toHaveBeenLastCalledWith("/veiculos/v1", {
      method: "PATCH",
      data: { kmProximaRevisao: 20000.25 },
    });
    expect(atualizado).toHaveBeenCalledWith(20000.25);
    await user.clear(screen.getByLabelText("Próxima revisão (km)"));
    await user.click(screen.getByRole("button", { name: "Salvar revisão" }));
    expect(apiRequest).toHaveBeenLastCalledWith("/veiculos/v1", {
      method: "PATCH",
      data: { kmProximaRevisao: null },
    });
  });
  it("preserva o indicador salvo e o formulário quando a API recusa a alteração", async () => {
    const atualizado = vi.fn();
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha ao salvar"));
    render(
      <RevisaoVeiculo
        veiculoId="v1"
        odometroAtual={9000}
        kmProximaRevisao={10000}
        onAtualizado={atualizado}
      />,
    );
    fireEvent.change(screen.getByLabelText("Próxima revisão (km)"), { target: { value: "20000" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao salvar");
    expect(atualizado).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Próxima revisão (km)")).toHaveValue(20000);
    expect(screen.getByText("Próxima da revisão")).toBeInTheDocument();
  });
});

it("mantém o estágio de 90% em limites fracionários sem erro de ponto flutuante", () => {
  render(<IndicadorRevisao odometroAtual={900.63} kmProximaRevisao={1000.7} />);
  expect(screen.getByText("Próxima da revisão")).toBeInTheDocument();
  expect(screen.getByText("90%")).toBeInTheDocument();
});
