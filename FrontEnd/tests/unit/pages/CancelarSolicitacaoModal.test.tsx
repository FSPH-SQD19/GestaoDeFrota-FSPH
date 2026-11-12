import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import { CancelarSolicitacaoModal } from "../../../src/pages/solicitacoes/CancelarSolicitacaoModal";
import type { SolicitacaoViagem } from "../../../src/types/solicitacao";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));

const solicitacao: SolicitacaoViagem = {
  id: "sol-123",
  protocolo: "SV-2026-0099",
  solicitanteNome: "Marina Costa",
  setorOrigem: "LACEN",
  origem: "LACEN Maceió",
  destino: "Hospital Geral",
  dataHoraPretendida: "2026-11-20T10:00:00Z",
  quantidadePassageiros: 1,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Entrega de relatórios",
  status: "APROVADA",
  criadoEm: "2026-11-10T10:00:00Z",
  veiculoAlocado: { placa: "ABC1D23", modelo: "Chevrolet Spin" },
  motoristaAlocado: { nome: "Carlos Alberto" },
};

describe("CancelarSolicitacaoModal", () => {
  const onClose = vi.fn();
  const onConcluido = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza quando solicitacao for null ou isOpen for false", () => {
    const { container } = render(
      <CancelarSolicitacaoModal
        solicitacao={null}
        isOpen={true}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exibe alerta de liberação de veículo/motorista quando alocados", () => {
    render(
      <CancelarSolicitacaoModal
        solicitacao={solicitacao}
        isOpen={true}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Cancelar Solicitação SV-2026-0099" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Os recursos alocados \(veículo e motorista\) serão imediatamente liberados/,
      ),
    ).toBeInTheDocument();
  });

  it("valida obrigatoriedade do motivo com no mínimo 3 caracteres", async () => {
    const user = userEvent.setup();
    render(
      <CancelarSolicitacaoModal
        solicitacao={solicitacao}
        isOpen={true}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Descreva o motivo do cancelamento/);
    await user.type(textarea, "ab");
    await user.click(screen.getByRole("button", { name: "Confirmar Cancelamento" }));

    expect(
      screen.getByText("Informe uma justificativa com no mínimo 3 caracteres."),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("envia cancelamento com sucesso e chama onConcluido", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      mensagem: "Solicitação cancelada com sucesso.",
      dados: { ...solicitacao, status: "CANCELADA" },
    });

    const user = userEvent.setup();
    render(
      <CancelarSolicitacaoModal
        solicitacao={solicitacao}
        isOpen={true}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Descreva o motivo do cancelamento/);
    await user.type(textarea, "Reunião de alinhamento desmarcada pelo setor.");
    await user.click(screen.getByRole("button", { name: "Confirmar Cancelamento" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/solicitacoes/sol-123/cancelar", {
        method: "PATCH",
        data: { motivoCancelamento: "Reunião de alinhamento desmarcada pelo setor." },
      });
    });

    expect(onConcluido).toHaveBeenCalledWith("Solicitação cancelada com sucesso.");
  });

  it("exibe mensagem de erro quando a API falha", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("Não é possível cancelar uma viagem que já está em trânsito ou foi concluída."),
    );

    const user = userEvent.setup();
    render(
      <CancelarSolicitacaoModal
        solicitacao={solicitacao}
        isOpen={true}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Descreva o motivo do cancelamento/);
    await user.type(textarea, "Cancelamento solicitado.");
    await user.click(screen.getByRole("button", { name: "Confirmar Cancelamento" }));

    expect(
      await screen.findByText(
        "Não é possível cancelar uma viagem que já está em trânsito ou foi concluída.",
      ),
    ).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});
