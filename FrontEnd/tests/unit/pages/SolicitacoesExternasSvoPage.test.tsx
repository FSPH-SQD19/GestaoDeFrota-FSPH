import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SolicitacoesExternasSvoPage } from "../../../src/pages/solicitacoes/SolicitacoesExternasSvoPage";
import type { SolicitacaoExternaSvo } from "../../../src/services/solicitacoesExternasSvoService";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  aprovar: vi.fn(),
  recusar: vi.fn(),
}));

vi.mock("../../../src/services/solicitacoesExternasSvoService", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../../src/services/solicitacoesExternasSvoService")>();
  return {
    ...real,
    listarSolicitacoesExternasSvoGestor: mocks.listar,
    aprovarSolicitacaoExternaSvo: mocks.aprovar,
    recusarSolicitacaoExternaSvo: mocks.recusar,
  };
});

const solicitacao: SolicitacaoExternaSvo = {
  id: "00000000-0000-4000-8000-000000000001",
  protocolo: "SE-SVO-2026-0001",
  status: "AGUARDANDO_GESTOR",
  nomeSolicitante: "Solicitante Sintético",
  localOcorrencia: "Rua Teste, 10",
  criadoEm: "2026-11-19T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listar.mockResolvedValue({
    data: [solicitacao],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  mocks.aprovar.mockResolvedValue({ mensagem: "Aprovação registrada." });
  mocks.recusar.mockResolvedValue({ mensagem: "Recusa registrada." });
});

describe("SolicitacoesExternasSvoPage", () => {
  it("reutiliza a chave de idempotência em retries enquanto o modal permanece aberto", async () => {
    const user = userEvent.setup();
    mocks.aprovar
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockResolvedValueOnce({ mensagem: "Aprovação registrada." });

    render(<SolicitacoesExternasSvoPage />);
    await user.click(await screen.findByRole("button", { name: "Aprovar" }));
    await user.type(screen.getByLabelText(/Justificativa interna/), "Triagem validada.");
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária");

    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    await waitFor(() => expect(mocks.aprovar).toHaveBeenCalledTimes(2));

    const primeira = mocks.aprovar.mock.calls[0];
    const segunda = mocks.aprovar.mock.calls[1];
    expect(primeira[0]).toBe(solicitacao.id);
    expect(segunda[0]).toBe(solicitacao.id);
    expect(segunda[1]).toBe(primeira[1]);
  });

  it("remove o item decidido imediatamente e não permite nova ação sobre ele", async () => {
    const user = userEvent.setup();
    mocks.listar
      .mockResolvedValueOnce({
        data: [solicitacao],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      })
      .mockRejectedValueOnce(new Error("Falha ao atualizar"));

    render(<SolicitacoesExternasSvoPage />);
    await user.click(await screen.findByRole("button", { name: "Aprovar" }));
    await user.type(screen.getByLabelText(/Justificativa interna/), "Triagem validada.");
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    await waitFor(() => expect(screen.queryByText("SE-SVO-2026-0001")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  });

  it("aplica variante visual diferente para aprovação e recusa", async () => {
    mocks.listar.mockResolvedValue({
      data: [
        { ...solicitacao, id: "a", protocolo: "SE-APROVADA", status: "APROVADA" },
        { ...solicitacao, id: "r", protocolo: "SE-RECUSADA", status: "RECUSADA" },
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    render(<SolicitacoesExternasSvoPage />);
    expect(await screen.findByText("SE-APROVADA")).toBeInTheDocument();
    expect(screen.getByText("SE-RECUSADA")).toBeInTheDocument();
    expect(screen.getByText("Aprovada").parentElement?.className).toContain("emerald");
    expect(screen.getByText("Recusada").parentElement?.className).toContain("rose");
  });

  it("exibe parecer da triagem, histórico e vínculo com ChamadoSvo", async () => {
    const user = userEvent.setup();
    mocks.listar.mockResolvedValue({
      data: [
        {
          ...solicitacao,
          relatoTriagem: "Óbito compatível com critérios de atendimento.",
          chamadoSvoId: "chamado-svo-1",
          chamadoSvoProtocolo: "SVO-2026-0041",
          historico: [
            {
              statusNovo: "AGUARDANDO_GESTOR",
              statusAnterior: "AGUARDANDO_TRIAGEM",
              autorNome: "Atendente SVO",
              criadoEm: "2026-11-19T12:30:00.000Z",
            },
          ],
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    render(<SolicitacoesExternasSvoPage />);
    expect(
      await screen.findByText("Óbito compatível com critérios de atendimento."),
    ).toBeInTheDocument();
    expect(screen.getByText("Chamado SVO: SVO-2026-0041")).toBeInTheDocument();
    await user.click(screen.getByText("Histórico (1)"));
    expect(screen.getByText("Histórico (1)").closest("details")).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(
      screen.getByRole("dialog", { name: "Aprovar solicitação SE-SVO-2026-0001" }),
    ).toBeInTheDocument();
  });

  it("exige justificativa antes de confirmar uma recusa", async () => {
    const user = userEvent.setup();
    render(<SolicitacoesExternasSvoPage />);
    await user.click(await screen.findByRole("button", { name: "Recusar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 5 caracteres");
    expect(mocks.recusar).not.toHaveBeenCalled();
  });
});
