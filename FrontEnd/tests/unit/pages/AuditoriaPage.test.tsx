import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditoriaPage } from "../../../src/pages/auditoria/AuditoriaPage";
import { listarAuditoriaApi } from "../../../src/services/auditoriaService";
import type { ItemAuditoria, ListaAuditoriaResposta } from "../../../src/types/auditoria";

vi.mock("../../../src/services/auditoriaService", () => ({
  listarAuditoriaApi: vi.fn(),
}));

const mockLogs: ItemAuditoria[] = [
  {
    id: "log-1",
    usuarioId: "usr-1",
    acao: "CRIAR",
    tabelaAfetada: "SOLICITACAO_VIAGEM",
    registroId: "sol-100",
    dadosNovos: { setor: "UTI", motivo: "Transporte" },
    criadoEm: "2026-11-10T10:00:00.000Z",
    usuario: {
      id: "usr-1",
      nome: "Mariana Silva",
      email: "mariana@fsph.se.gov.br",
      setor: "UTI",
    },
  },
  {
    id: "log-2",
    usuarioId: "usr-2",
    acao: "CANCELAR",
    tabelaAfetada: "SOLICITACAO_VIAGEM",
    registroId: "sol-101",
    dadosNovos: { motivoCancelamento: "Paciente transferido" },
    criadoEm: "2026-11-10T11:00:00.000Z",
    usuario: {
      id: "usr-2",
      nome: "Roberto Gestor",
      email: "roberto@fsph.se.gov.br",
      setor: "FROTA",
    },
  },
];

const mockResposta: ListaAuditoriaResposta = {
  data: mockLogs,
  meta: {
    total: 2,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  },
};

describe("AuditoriaPage", () => {
  beforeEach(() => {
    vi.mocked(listarAuditoriaApi).mockReset().mockResolvedValue(mockResposta);
  });

  it("renderiza cabeçalho, KPIs e tabela com logs", async () => {
    render(<AuditoriaPage />);

    expect(screen.getByRole("heading", { name: "Trilha de Auditoria" })).toBeInTheDocument();
    expect(screen.getByText("LGPD Ativo")).toBeInTheDocument();
    expect(screen.getByText("Restrito a ADMIN")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Mariana Silva")).toBeInTheDocument();
      expect(screen.getByText("Roberto Gestor")).toBeInTheDocument();
      expect(screen.getByText("CRIAR")).toBeInTheDocument();
      expect(screen.getByText("CANCELAR")).toBeInTheDocument();
    });

    expect(listarAuditoriaApi).toHaveBeenCalledTimes(1);
  });

  it("permite filtrar por busca textual e submeter formulário", async () => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);

    await waitFor(() => {
      expect(screen.getByText("Mariana Silva")).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText("Buscar no Registro");
    await user.type(searchInput, "sol-100");

    const buscarButton = screen.getByRole("button", { name: "Aplicar Busca" });
    await user.click(buscarButton);

    await waitFor(() => {
      expect(listarAuditoriaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          busca: "sol-100",
          page: 1,
        }),
      );
    });
  });

  it("abre o modal de detalhes ao clicar em Inspecionar", async () => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);

    await waitFor(() => {
      expect(screen.getByText("Mariana Silva")).toBeInTheDocument();
    });

    const botoesInspecionar = screen.getAllByRole("button", { name: /Inspecionar/i });
    await user.click(botoesInspecionar[0]);

    await waitFor(() => {
      expect(screen.getByText("Detalhes do Log de Auditoria")).toBeInTheDocument();
      expect(screen.getByTestId("payload-json")).toHaveTextContent("Transporte");
    });
  });

  it("exibe mensagem quando não há logs encontrados", async () => {
    vi.mocked(listarAuditoriaApi).mockResolvedValueOnce({
      data: [],
      meta: {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
    });

    render(<AuditoriaPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Nenhum registro de auditoria encontrado para os filtros selecionados."),
      ).toBeInTheDocument();
    });
  });

  it("exibe mensagem de erro quando a chamada da API falha", async () => {
    vi.mocked(listarAuditoriaApi).mockRejectedValueOnce(
      new Error("Falha na comunicação com o servidor de auditoria."),
    );

    render(<AuditoriaPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Falha na comunicação com o servidor de auditoria."),
      ).toBeInTheDocument();
    });
  });
});
