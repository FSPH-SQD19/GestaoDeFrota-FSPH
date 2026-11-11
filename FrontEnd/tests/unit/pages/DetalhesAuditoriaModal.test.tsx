import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DetalhesAuditoriaModal } from "../../../src/pages/auditoria/DetalhesAuditoriaModal";
import type { ItemAuditoria } from "../../../src/types/auditoria";

describe("DetalhesAuditoriaModal", () => {
  const logMock: ItemAuditoria = {
    id: "log-1",
    usuarioId: "usr-123",
    acao: "CRIAR_SOLICITACAO",
    tabelaAfetada: "SOLICITACAO_VIAGEM",
    registroId: "solic-456",
    dadosNovos: {
      destino: "Hospital Regional de Itabaiana",
      urgencia: "ALTA",
      senha: "******",
    },
    criadoEm: "2026-11-10T14:30:00.000Z",
    usuario: {
      id: "usr-123",
      nome: "Carlos Gestor",
      email: "carlos@fsph.se.gov.br",
      setor: "FROTA",
    },
  };

  it("renderiza detalhes completos do log de auditoria", () => {
    render(
      <DetalhesAuditoriaModal
        log={logMock}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Detalhes do Log de Auditoria")).toBeInTheDocument();
    expect(screen.getByText("CRIAR_SOLICITACAO")).toBeInTheDocument();
    expect(screen.getByText("SOLICITACAO_VIAGEM")).toBeInTheDocument();
    expect(screen.getByText("solic-456")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Gestor/i)).toBeInTheDocument();
    expect(screen.getByText(/carlos@fsph.se.gov.br/i)).toBeInTheDocument();
    expect(screen.getByText("FROTA")).toBeInTheDocument();
    expect(screen.getByTestId("payload-json")).toHaveTextContent("Hospital Regional de Itabaiana");
    expect(screen.getByTestId("payload-json")).toHaveTextContent("******");
  });

  it("renderiza mensagem amigável quando não houver dadosNovos", () => {
    const logSemPayload: ItemAuditoria = {
      ...logMock,
      dadosNovos: null,
    };

    render(
      <DetalhesAuditoriaModal
        log={logSemPayload}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Nenhum dado payload adicional registrado nesta operação."),
    ).toBeInTheDocument();
  });

  it("chama onClose ao clicar no botão Fechar", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <DetalhesAuditoriaModal
        log={logMock}
        isOpen={true}
        onClose={handleClose}
      />,
    );

    const botoesFechar = screen.getAllByRole("button", { name: "Fechar" });
    await user.click(botoesFechar[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
