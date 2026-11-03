import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../../../src/components/layout/Header";
import { AuthContext } from "../../../src/contexts/auth";
import {
  dispararAtualizacaoNotificacoes,
  listarNotificacoesApi,
  marcarNotificacaoLidaApi,
  marcarTodasNotificacoesLidasApi,
} from "../../../src/services/notificacoesService";

vi.mock("../../../src/services/notificacoesService", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../src/services/notificacoesService")>();
  return {
    ...real,
    listarNotificacoesApi: vi.fn(),
    marcarNotificacaoLidaApi: vi.fn(),
    marcarTodasNotificacoesLidasApi: vi.fn(),
  };
});

function renderizarHeaderComUsuario() {
  return render(
    <AuthContext.Provider
      value={{
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          nome: "Bruno Santana",
          email: "bruno@fsph.se.gov.br",
          roles: ["GESTOR"],
        },
        sessionKey: "sessao-notificacoes",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasRole: (roles) => roles.includes("GESTOR"),
      }}
    >
      <Header />
    </AuthContext.Provider>,
  );
}

describe("NotificacoesDropdown no Header", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("exibe contador de não lidas, permite filtrar, marcar individual e marcar todas como lidas", async () => {
    const user = userEvent.setup({ delay: null });
    const agoraIso = new Date().toISOString();

    vi.mocked(listarNotificacoesApi).mockResolvedValue({
      data: [
        {
          id: "00000000-0000-4000-8000-0000000000n1",
          tipo: "SOLICITACAO_URGENTE",
          titulo: "Solicitação urgente SV-2026-0099",
          mensagem: "Nova solicitação urgente do setor LACEN para HEMOSE.",
          referenciaTipo: "SOLICITACAO_VIAGEM",
          referenciaId: "00000000-0000-4000-8000-0000000000s1",
          lida: false,
          lidaEm: null,
          criadoEm: agoraIso,
        },
        {
          id: "00000000-0000-4000-8000-0000000000n2",
          tipo: "SVO_DESINFECCAO_CONCLUIDA",
          titulo: "Viatura SVO9A88 liberada da desinfecção",
          mensagem: "A viatura SVO9A88 concluiu a desinfecção.",
          referenciaTipo: "VEICULO",
          referenciaId: "00000000-0000-4000-8000-0000000000v1",
          lida: false,
          lidaEm: null,
          criadoEm: agoraIso,
        },
        {
          id: "00000000-0000-4000-8000-0000000000n3",
          tipo: "VIAGEM_APROVADA",
          titulo: "Viagem SV-2026-0050 aprovada",
          mensagem: "Sua solicitação foi aprovada com o veículo ABC1D23.",
          referenciaTipo: "SOLICITACAO_VIAGEM",
          referenciaId: "00000000-0000-4000-8000-0000000000s2",
          lida: true,
          lidaEm: agoraIso,
          criadoEm: agoraIso,
        },
      ],
      meta: { naoLidas: 2, retornadas: 3 },
    });

    vi.mocked(marcarNotificacaoLidaApi).mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000n1",
      tipo: "SOLICITACAO_URGENTE",
      titulo: "Solicitação urgente SV-2026-0099",
      mensagem: "Nova solicitação urgente do setor LACEN para HEMOSE.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: "00000000-0000-4000-8000-0000000000s1",
      lida: true,
      lidaEm: agoraIso,
      criadoEm: agoraIso,
    });
    vi.mocked(marcarTodasNotificacoesLidasApi).mockResolvedValue({
      atualizadas: 1,
      naoLidas: 0,
    });

    renderizarHeaderComUsuario();

    const badge = await screen.findByTestId("notificacoes-badge");
    expect(badge).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Notificações" }));
    expect(screen.getByRole("dialog", { name: "Central de notificações" })).toBeInTheDocument();
    expect(screen.getByText("Solicitação urgente SV-2026-0099")).toBeInTheDocument();
    expect(screen.getByText("Viagem SV-2026-0050 aprovada")).toBeInTheDocument();

    // Filtra apenas não lidas consultando o servidor com apenasNaoLidas=true
    await user.click(screen.getByRole("button", { name: /Não lidas \(2\)/i }));
    expect(listarNotificacoesApi).toHaveBeenLastCalledWith({
      apenasNaoLidas: true,
      limit: 25,
    });
    expect(screen.queryByText("Viagem SV-2026-0050 aprovada")).not.toBeInTheDocument();

    // Marca a primeira notificação como lida
    const botoesMarcarUma = screen.getAllByRole("button", { name: /Marcar como lida/i });
    await user.click(botoesMarcarUma[0]!);

    expect(marcarNotificacaoLidaApi).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000n1");
    await waitFor(() => {
      expect(screen.getByTestId("notificacoes-badge")).toHaveTextContent("1");
    });

    // Marca todas as restantes como lidas
    await user.click(screen.getByRole("button", { name: /Marcar todas como lidas/i }));
    expect(marcarTodasNotificacoesLidasApi).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByTestId("notificacoes-badge")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Nenhuma notificação não lida.")).toBeInTheDocument();
  });

  it("busca notificações não lidas mais antigas no servidor quando não estão entre as 25 iniciais", async () => {
    const user = userEvent.setup({ delay: null });
    const agoraIso = new Date().toISOString();

    const vinteCincoLidas = Array.from({ length: 25 }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
      tipo: "VIAGEM_APROVADA",
      titulo: `Viagem lida #${i + 1}`,
      mensagem: "Viagem concluída anteriormente.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: null,
      lida: true,
      lidaEm: agoraIso,
      criadoEm: agoraIso,
    }));

    const pendenciaAntiga = {
      id: "00000000-0000-4000-8000-000000000999",
      tipo: "DOCUMENTO_VEICULO_VENCENDO",
      titulo: "CRLV vencido — QWE1D23",
      mensagem: "O documento CRLV do veículo QWE1D23 venceu.",
      referenciaTipo: "VEICULO",
      referenciaId: null,
      lida: false,
      lidaEm: null,
      criadoEm: "2026-10-01T10:00:00.000Z",
    };

    vi.mocked(listarNotificacoesApi).mockImplementation(async (params) => {
      if (params?.apenasNaoLidas) {
        return {
          data: [pendenciaAntiga],
          meta: { naoLidas: 1, retornadas: 1 },
        };
      }
      return {
        data: vinteCincoLidas,
        meta: { naoLidas: 1, retornadas: 25 },
      };
    });

    renderizarHeaderComUsuario();
    expect(await screen.findByTestId("notificacoes-badge")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Notificações" }));
    expect(screen.getByText(/Há 1 pendência não lida mais antiga/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Não lidas \(1\)/i }));
    expect(await screen.findByText("CRLV vencido — QWE1D23")).toBeInTheDocument();
  });

  it("exibe estado explícito de erro em vez de lista vazia quando a consulta à API falha e permite tentar novamente", async () => {
    const user = userEvent.setup({ delay: null });

    vi.mocked(listarNotificacoesApi)
      .mockRejectedValueOnce(new Error("Erro de rede"))
      .mockRejectedValueOnce(new Error("Erro de rede"))
      .mockResolvedValueOnce({
        data: [],
        meta: { naoLidas: 0, retornadas: 0 },
      });

    renderizarHeaderComUsuario();
    await waitFor(() => expect(listarNotificacoesApi).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Notificações" }));

    const alertaErro = await screen.findByRole("alert");
    expect(alertaErro).toHaveTextContent("Não foi possível consultar as notificações.");
    expect(screen.queryByText("Nenhuma notificação no momento.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(await screen.findByText("Nenhuma notificação no momento.")).toBeInTheDocument();
  });

  it("atualiza o contador automaticamente quando um evento operacional dispara atualização", async () => {
    vi.mocked(listarNotificacoesApi)
      .mockResolvedValueOnce({
        data: [],
        meta: { naoLidas: 0, retornadas: 0 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "00000000-0000-4000-8000-0000000000n9",
            tipo: "CNH_VENCENDO",
            titulo: "CNH próxima do vencimento — Carlos",
            mensagem: "A CNH vence em 15 dia(s).",
            referenciaTipo: "MOTORISTA",
            referenciaId: null,
            lida: false,
            lidaEm: null,
            criadoEm: new Date().toISOString(),
          },
        ],
        meta: { naoLidas: 1, retornadas: 1 },
      });

    renderizarHeaderComUsuario();
    await waitFor(() => expect(listarNotificacoesApi).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("notificacoes-badge")).not.toBeInTheDocument();

    act(() => {
      dispararAtualizacaoNotificacoes();
    });

    expect(await screen.findByTestId("notificacoes-badge")).toHaveTextContent("1");
  });
});
