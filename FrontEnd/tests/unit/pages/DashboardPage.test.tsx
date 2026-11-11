import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../../src/pages/dashboard/DashboardPage";
import { AuthProvider } from "../../helpers/auth";
import { apiRequest } from "../../../src/lib/api";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const resumo = {
  veiculos: {
    total: 155,
    totalGeral: 157,
    porStatus: {
      DISPONIVEL: 130,
      EM_VIAGEM: 20,
      MANUTENCAO: 5,
      DESINFECCAO: 0,
      INATIVO: 2,
    },
    porTipoFrota: {
      ADMINISTRATIVA: {
        total: 125,
        totalGeral: 125,
        porStatus: {
          DISPONIVEL: 105,
          EM_VIAGEM: 15,
          MANUTENCAO: 5,
          DESINFECCAO: 0,
          INATIVO: 0,
        },
      },
      SVO: {
        total: 30,
        totalGeral: 32,
        porStatus: {
          DISPONIVEL: 25,
          EM_VIAGEM: 5,
          MANUTENCAO: 0,
          DESINFECCAO: 0,
          INATIVO: 2,
        },
      },
    },
  },
  solicitacoes: {
    data: [],
    meta: {
      total: 400,
      porStatus: { PENDENTE: 25, APROVADA: 10, EM_TRANSITO: 5, CONCLUIDA: 355, RECUSADA: 5 },
    },
  },
  viagensDoDia: 3,
  svo: { chamadosAtivos: 4, slaMedioRespostaMinutos: 17.5, slaMedioEntregaMinutos: 45 },
  alertasOperacionais: { total: 0, cnh: [], documentos: [] },
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
  it("exibe alertas de CNH e documentos dentro da janela operacional de 30 dias", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      ...resumo,
      alertasOperacionais: {
        total: 3,
        cnh: [
          {
            motoristaId: "m1",
            nome: "Maria Condutora",
            dataVencimento: "2026-11-05",
            situacao: "VENCIDO",
          },
        ],
        documentos: [
          {
            id: "d1",
            veiculoId: "v1",
            placa: "ABC1234",
            tipoDocumento: "CRLV",
            dataVencimento: "2026-11-08",
            atual: true,
            situacao: "VENCIDO",
            diasParaVencer: -2,
          },
          {
            id: "d2",
            veiculoId: "v1",
            placa: "ABC1234",
            tipoDocumento: "IPVA",
            dataVencimento: "2026-11-10",
            atual: true,
            situacao: "PROXIMO_VENCIMENTO",
            diasParaVencer: 0,
          },
          {
            id: "d3",
            veiculoId: "v2",
            placa: "DEF5678",
            tipoDocumento: "SEGURO",
            dataVencimento: "2026-12-10",
            atual: true,
            situacao: "PROXIMO_VENCIMENTO",
            diasParaVencer: 30,
          },
        ],
      },
    });
    renderDashboard();
    expect(await screen.findByText("Vencido há 2 dia(s)")).toBeInTheDocument();
    expect(screen.getByText("Vence hoje")).toBeInTheDocument();
    expect(screen.getByText("Vence em 30 dia(s)")).toBeInTheDocument();
    expect(screen.getByText("Veículo ABC1234 — CRLV")).toBeInTheDocument();
    expect(screen.getByText("Maria Condutora")).toBeInTheDocument();
    expect(screen.getByText(/CNH vencida/)).toBeInTheDocument();
  });

  it("exibe indicadores agregados e a frota segmentada por categoria e situação", async () => {
    renderDashboard();
    expect(await screen.findByText("155", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("157 cadastrados no total")).toBeInTheDocument();
    expect(screen.getByText("105", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("25", { exact: true })).toHaveLength(2);
    expect(screen.getByText("Viagens do dia")).toBeInTheDocument();
    expect(screen.getByText("Chamados SVO ativos")).toBeInTheDocument();
    expect(screen.getByText("SLA médio de resposta")).toBeInTheDocument();
    expect(screen.getByText("17,5 min")).toBeInTheDocument();
    expect(screen.getByText("SLA médio de entrega")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("3", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("4", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("400", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Administrativa")).toBeInTheDocument();
    expect(screen.getByText("SVO", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("Inativos")).toHaveLength(2);
    expect(screen.getAllByText("Em desinfecção")).toHaveLength(1);
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
    expect(screen.queryByText("Nenhum alerta operacional ativo.")).not.toBeInTheDocument();
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
