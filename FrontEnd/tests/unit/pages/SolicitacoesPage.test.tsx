import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { apiRequest } from "../../../src/lib/api";
import { SolicitacoesPage } from "../../../src/pages/solicitacoes/SolicitacoesPage";
import type { SolicitacaoViagem, StatusSolicitacao } from "../../../src/types/solicitacao";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);

function criarSolicitacao(
  dados: Partial<SolicitacaoViagem> & Pick<SolicitacaoViagem, "id" | "protocolo" | "status">,
): SolicitacaoViagem {
  return {
    solicitanteNome: "Solicitante de teste",
    setorOrigem: "LACEN",
    origem: "LACEN — Aracaju",
    destino: "Hospital Regional",
    dataHoraPretendida: "2026-11-02T12:00:00.000Z",
    dataHoraRetornoPrevista: null,
    quantidadePassageiros: 1,
    tipoTransporte: "PASSAGEIROS",
    urgencia: "NORMAL",
    justificativa: "Atividade institucional.",
    criadoEm: "2026-10-28T12:00:00.000Z",
    ...dados,
  };
}

const solicitacoesIniciais: SolicitacaoViagem[] = [
  criarSolicitacao({ id: "sol-pendente", protocolo: "SV-2026-0142", status: "PENDENTE" }),
  criarSolicitacao({
    id: "sol-aprovada",
    protocolo: "SV-2026-0137",
    status: "APROVADA",
    veiculoAlocado: { placa: "BRA-2E19", modelo: "Van" },
    motoristaAlocado: { nome: "Carlos Alberto" },
  }),
  criarSolicitacao({
    id: "sol-recusada",
    protocolo: "SV-2026-0098",
    status: "RECUSADA",
    motivoRecusa: "Indisponibilidade de veículo.",
  }),
  criarSolicitacao({ id: "sol-concluida", protocolo: "SV-2026-0130", status: "CONCLUIDA" }),
  criarSolicitacao({ id: "sol-transito", protocolo: "SV-2026-0140", status: "EM_TRANSITO" }),
];

const novaSolicitacao = criarSolicitacao({
  id: "sol-nova",
  protocolo: "SV-2026-0143",
  status: "PENDENTE",
  origem: "LACEN — Aracaju",
  destino: "Hospital de Propriá",
  criadoEm: "2026-10-30T12:00:00.000Z",
});

function criarRespostaSolicitacoes(data: SolicitacaoViagem[]) {
  const porStatus: Record<StatusSolicitacao, number> = {
    PENDENTE: 0,
    APROVADA: 0,
    EM_TRANSITO: 0,
    CONCLUIDA: 0,
    RECUSADA: 0,
  };

  for (const solicitacao of data) porStatus[solicitacao.status] += 1;

  return { data, meta: { total: data.length, porStatus } };
}

function renderPage() {
  return render(
    <AuthProvider>
      <SolicitacoesPage />
    </AuthProvider>,
  );
}

function dataFuturaLocal(dias: number, hora: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

describe("SolicitacoesPage (visão do solicitante)", () => {
  beforeEach(() => {
    let solicitacoes = [...solicitacoesIniciais];
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        solicitacoes = [novaSolicitacao, ...solicitacoes];
        return novaSolicitacao as never;
      }

      if (path.startsWith("/solicitacoes")) {
        return criarRespostaSolicitacoes(solicitacoes) as never;
      }

      throw new Error(`Chamada inesperada à API de teste: ${path}`);
    });
  });

  it("lista as solicitações e mostra os indicadores", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Minhas Solicitações de Viagem" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("SV-2026-0142")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6); // cabeçalho + 5 solicitações
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("filtra por status recusada", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SV-2026-0142");
    await user.click(screen.getByRole("tab", { name: "Recusadas" }));

    expect(screen.getByText("SV-2026-0098")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0142")).not.toBeInTheDocument();
  });

  it("exibe erros de validação ao enviar o formulário vazio", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));

    expect(await screen.findByText("Informe o local de partida.")).toBeInTheDocument();
    expect(screen.getByText("Informe o destino da viagem.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data e hora de saída.")).toBeInTheDocument();
  });

  it("cria uma nova solicitação pendente com dados válidos", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.selectOptions(screen.getByLabelText(/^setor solicitante/i), "LACEN");
    await user.type(screen.getByLabelText(/^origem/i), "LACEN — Aracaju");
    await user.type(screen.getByLabelText(/^destino/i), "Hospital de Propriá");
    fireEvent.change(screen.getByLabelText(/data e hora de saída/i), {
      target: { value: dataFuturaLocal(3, 9) },
    });
    await user.type(
      screen.getByLabelText(/^justificativa/i),
      "Transporte de equipe para capacitação.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/enviada/i);
    expect(await screen.findByText("SV-2026-0143")).toBeInTheDocument();
    expect(screen.getByText("Hospital de Propriá")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("mostra veículo e motorista nos detalhes de uma viagem aprovada", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SV-2026-0137");
    await user.click(
      screen.getByRole("button", { name: "Ver detalhes da solicitação SV-2026-0137" }),
    );

    const dialogo = screen
      .getByText("Solicitação SV-2026-0137")
      .closest("div.relative") as HTMLElement;
    expect(within(dialogo).getByText("BRA-2E19")).toBeInTheDocument();
    expect(within(dialogo).getByText("Carlos Alberto")).toBeInTheDocument();
  });
});
