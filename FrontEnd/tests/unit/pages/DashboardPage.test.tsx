import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../../src/pages/dashboard/DashboardPage";
import { AuthProvider } from "../../helpers/auth";
import { apiRequest } from "../../../src/lib/api";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const resumo = {
  alertas: [],
  veiculos: {
    total: 155,
    porStatus: { DISPONIVEL: 130, EM_VIAGEM: 20, MANUTENCAO: 5, DESINFECCAO: 0 },
  },
  solicitacoes: {
    data: [],
    meta: {
      total: 400,
      porStatus: { PENDENTE: 25, APROVADA: 10, EM_TRANSITO: 5, CONCLUIDA: 355, RECUSADA: 5 },
    },
  },
};
function renderDashboard() {
  return render(
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest).mockResolvedValue(resumo);
});
describe("DashboardPage", () => {
  it("exibe os alertas reais, inclusive documentos que vencem hoje", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      ...resumo,
      alertas: [
        {
          id: "d1",
          placa: "ABC1234",
          tipoDocumento: "CRLV",
          situacao: "VENCIDO",
          diasParaVencer: -2,
        },
        {
          id: "d2",
          placa: "ABC1234",
          tipoDocumento: "IPVA",
          situacao: "PROXIMO_VENCIMENTO",
          diasParaVencer: 0,
        },
        {
          id: "d3",
          placa: "DEF5678",
          tipoDocumento: "SEGURO",
          situacao: "PROXIMO_VENCIMENTO",
          diasParaVencer: 90,
        },
      ],
    });
    renderDashboard();
    expect(await screen.findByText("Vencido há 2 dia(s)")).toBeInTheDocument();
    expect(screen.getByText("Vence hoje")).toBeInTheDocument();
    expect(screen.getByText("Vence em 90 dia(s)")).toBeInTheDocument();
    expect(screen.getByText("Veículo ABC1234 — CRLV")).toBeInTheDocument();
  });

  it("usa os totais agregados do backend mesmo com mais de 100 veículos", async () => {
    renderDashboard();
    expect(await screen.findByText("155", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("130 disponíveis")).toBeInTheDocument();
    expect(screen.getByText("20", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("25", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("400", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("5 veículo(s) em manutenção")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/dashboard/resumo");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("reutiliza a mesma consulta ao atualizar e permite tentar novamente após uma falha", async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("Não foi possível carregar os indicadores."),
    );
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os indicadores.",
    );
    expect(screen.queryByText("Nenhum documento com vencimento próximo.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("155", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/dashboard/resumo");
    vi.mocked(apiRequest).mockResolvedValueOnce({
      ...resumo,
      veiculos: { ...resumo.veiculos, total: 160 },
    });
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(screen.getByText("160", { exact: true })).toBeInTheDocument());
  });
});
