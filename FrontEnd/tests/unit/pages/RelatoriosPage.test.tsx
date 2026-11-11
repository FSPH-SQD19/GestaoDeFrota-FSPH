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

  it("consulta as agregações de consumo, manutenções e viagens por setor na API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nenhum veículo no período selecionado.");

    vi.mocked(apiRequest).mockResolvedValueOnce({
      inicio: "2026-11-01",
      fim: "2026-11-10",
      setor: null,
      dados: [
        {
          placa: "QKN1A23",
          modelo: "Renault Master",
          kmRodados: 320,
          litrosAbastecidos: 40,
          consumoMedioKmL: 8,
        },
      ],
    });
    await user.click(screen.getByRole("tab", { name: "Consumo médio (km/L)" }));
    expect(await screen.findByText("QKN1A23")).toBeInTheDocument();
    expect(screen.getByText("8 km/L")).toBeInTheDocument();

    vi.mocked(apiRequest).mockResolvedValueOnce({
      inicio: "2026-11-01",
      fim: "2026-11-10",
      setor: null,
      dados: [
        {
          tipo: "PREVENTIVA",
          status: "CONCLUIDA",
          quantidade: 3,
          custoTotal: 1450.5,
        },
      ],
    });
    await user.click(screen.getByRole("tab", { name: "Manutenções" }));
    expect(await screen.findByText("Preventiva")).toBeInTheDocument();
    expect(screen.getAllByText(/1\.450,50/).length).toBeGreaterThan(0);

    vi.mocked(apiRequest).mockResolvedValueOnce({
      inicio: "2026-11-01",
      fim: "2026-11-10",
      setor: null,
      dados: [{ setor: "LACEN", status: "CONCLUIDA", viagens: 12 }],
    });
    await user.click(screen.getByRole("tab", { name: "Viagens por setor" }));
    expect(await screen.findByText("LACEN")).toBeInTheDocument();

    vi.mocked(apiRequest).mockResolvedValueOnce({
      inicio: "2026-11-01",
      fim: "2026-11-10",
      setor: "HEMOSE",
      dados: [{ setor: "HEMOSE", status: "EM_TRANSITO", viagens: 4 }],
    });
    await user.type(screen.getByLabelText("Filtrar por setor"), "HEMOSE");
    await user.click(screen.getByRole("button", { name: "Filtrar setor" }));
    expect((await screen.findAllByText("HEMOSE")).length).toBeGreaterThanOrEqual(1);
    expect(apiRequest).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/relatorios\/viagens\?inicio=.*&fim=.*&setor=HEMOSE$/),
      {},
    );
  });

  it("habilita exportação em CSV, download em PDF e impressão em PDF", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const clickAnchorSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:relatorio");
    const revokeObjectUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    try {
      renderPage();
      await screen.findByText("Nenhum veículo no período selecionado.");

      await user.click(screen.getByRole("button", { name: /Imprimir PDF/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);

      vi.mocked(apiRequest).mockResolvedValueOnce({
        inicio: "2026-11-01",
        fim: "2026-11-10",
        setor: null,
        dados: [
          {
            placa: "BRA2E19",
            modelo: "Fiat Toro",
            kmRodados: 180,
            litrosAbastecidos: 20,
            consumoMedioKmL: 9,
          },
        ],
      });
      await user.click(screen.getByRole("tab", { name: "Consumo médio (km/L)" }));
      await screen.findByText("BRA2E19");

      vi.mocked(apiRequest).mockResolvedValueOnce(
        new Blob(["placa;modelo"], { type: "text/csv;charset=utf-8" }),
      );
      await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));
      expect(apiRequest).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\/relatorios\/consumo\?inicio=.*&fim=.*&formato=csv$/),
        { responseType: "blob" },
      );

      vi.mocked(apiRequest).mockResolvedValueOnce(
        new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      );
      await user.click(screen.getByRole("button", { name: /Exportar PDF/i }));
      expect(apiRequest).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\/relatorios\/consumo\?inicio=.*&fim=.*&formato=pdf$/),
        { responseType: "blob" },
      );
      expect(createObjectUrlSpy).toHaveBeenCalled();
      expect(clickAnchorSpy).toHaveBeenCalledTimes(2);
      expect(revokeObjectUrlSpy).toHaveBeenCalled();
    } finally {
      printSpy.mockRestore();
      clickAnchorSpy.mockRestore();
      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
    }
  });
});
