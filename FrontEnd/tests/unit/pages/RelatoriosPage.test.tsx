import { gerarCsv } from "../../../src/lib/relatorioCsv";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { RelatoriosPage } from "../../../src/pages/relatorios/RelatoriosPage";
import { apiRequest } from "../../../src/lib/api";
import type { RelatorioPeriodo } from "../../../src/types/relatorio";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const vazio: RelatorioPeriodo = {
  id: "periodo",
  rotulo: "período",
  kmRodados: 0,
  consumoEstimadoLitros: 0,
  viagensConcluidas: 0,
  viagensEmAberto: 0,
  desviosDeRota: null,
  veiculos: [],
  motoristas: [],
};
function renderPage() {
  return render(
    <AuthProvider>
      <RelatoriosPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue(vazio);
});

describe("RelatoriosPage", () => {
  it("carrega os dados e representa a ausência de registros sem valores fictícios", async () => {
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando relatório");
    expect(await screen.findByText("Nenhum veículo no período selecionado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();
    expect(screen.getByText("Sem quilometragem registrada no período.")).toBeInTheDocument();
    expect(document.querySelector("svg [d*=NaN]")).toBeNull();
  });
  it("envia o período à API e usa os novos indicadores", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nenhum veículo no período selecionado.");
    await user.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-10-15" } });
    vi.mocked(apiRequest).mockResolvedValue({ ...vazio, viagensConcluidas: 27 });
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("27")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenLastCalledWith("/relatorios?inicio=2026-10-01&fim=2026-10-15", {});
  });
  it("mostra falhas sem apresentar zero como resposta e permite tentar novamente", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha de conexão"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    expect(screen.queryByText("0L")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum veículo no período selecionado.")).toBeInTheDocument();
  });
  it("ignora respostas antigas quando o período muda", async () => {
    let resolver!: (dados: RelatorioPeriodo) => void;
    vi.mocked(apiRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve as typeof resolver;
        }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-09-30" } });
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    await screen.findByText("Nenhum veículo no período selecionado.");
    resolver({ ...vazio, viagensConcluidas: 999 });
    await waitFor(() => expect(screen.queryByText("999")).not.toBeInTheDocument());
  });
  it("gera CSV com escape de aspas, separadores, fórmulas e valores ausentes", () => {
    const csv = gerarCsv({
      ...vazio,
      veiculos: [
        {
          id: "v",
          codigo: "=1+1",
          descricao: 'Modelo; "Especial"',
          operacoes: 0,
          unidade: "viagens",
          kmRodados: 0,
          kmMedio: null,
          consumoLitros: 0,
          consumoMedio: null,
        },
      ],
    });
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"Modelo; ""Especial"""');
    expect(csv).not.toContain("null");
  });
});
