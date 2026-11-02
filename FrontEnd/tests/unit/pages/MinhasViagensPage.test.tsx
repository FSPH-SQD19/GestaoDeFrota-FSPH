import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listarMinhasViagensApi } from "../../../src/services/solicitacoesService";
import type { ListaMinhasViagensResposta } from "../../../src/types/solicitacao";
import { MinhasViagensPage } from "../../../src/pages/viagens/MinhasViagensPage";

vi.mock("../../../src/contexts/auth", () => ({
  useAuth: () => ({ sessionKey: "test-session" }),
}));

vi.mock("../../../src/services/solicitacoesService", () => ({
  listarMinhasViagensApi: vi.fn(),
}));

vi.mock("../../../src/pages/viagens/ChecklistViagemModal", () => ({
  ChecklistViagemModal: ({ modo }: { modo: string }) => <div role="dialog">Checklist {modo}</div>,
}));

const viagem: ListaMinhasViagensResposta["data"][number] = {
  id: "viagem-1",
  protocolo: "SV-2026-0042",
  solicitanteNome: "Equipe Hemose",
  setorOrigem: "Hemose",
  origem: "Hemose — Aracaju",
  destino: "LACEN — Unidade Central",
  dataHoraPretendida: "2026-11-03T08:30:00-03:00",
  quantidadePassageiros: 2,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Transporte institucional.",
  status: "APROVADA",
  criadoEm: "2026-11-01T10:00:00-03:00",
  veiculoAlocado: { placa: "QKN-2A34", modelo: "Fiat Argo", odometroAtual: 42510 },
  motoristaAlocado: { nome: "Motorista" },
  execucao: null,
};

const lista: ListaMinhasViagensResposta = {
  data: [viagem],
  viagemEmAndamento: null,
  meta: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    porStatus: { PENDENTE: 0, APROVADA: 1, EM_TRANSITO: 0, CONCLUIDA: 0, RECUSADA: 0 },
  },
};

describe("MinhasViagensPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarMinhasViagensApi).mockResolvedValue(lista);
  });

  it("carrega do endpoint do motorista e mantém as viagens a iniciar em destaque", async () => {
    render(<MinhasViagensPage />);

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("LACEN — Unidade Central")).toBeInTheDocument();
    expect(screen.getByText("Solicitante: Equipe Hemose")).toBeInTheDocument();
    expect(listarMinhasViagensApi).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: undefined,
    });

    await userEvent.click(screen.getByRole("button", { name: "Iniciar viagem" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Checklist SAIDA");
  });

  it("retoma a viagem em andamento vinda do endpoint", async () => {
    vi.mocked(listarMinhasViagensApi).mockResolvedValue({
      ...lista,
      data: [],
      viagemEmAndamento: {
        ...viagem,
        status: "EM_TRANSITO",
        execucao: { kmInicial: 42510, dataHoraInicio: "2026-11-03T08:35:00-03:00" },
      },
    });

    render(<MinhasViagensPage />);

    expect(await screen.findByRole("heading", { name: "Viagem em andamento" })).toBeInTheDocument();
    expect(screen.getByText("LACEN — Unidade Central")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir viagem" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Checklist RETORNO");
  });

  it("apresenta erro de carregamento e permite tentar novamente", async () => {
    const user = userEvent.setup();
    vi.mocked(listarMinhasViagensApi)
      .mockRejectedValueOnce(new Error("Falha de conexão"))
      .mockResolvedValueOnce(lista);

    render(<MinhasViagensPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    await waitFor(() => expect(listarMinhasViagensApi).toHaveBeenCalledTimes(2));
  });
});
