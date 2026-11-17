import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinhasColetasSvoPage } from "../../../src/pages/svo/MinhasColetasSvoPage";
import type { MinhaColetaSvo } from "../../../src/services/svo";

const mocks = vi.hoisted(() => ({
  obterMinhasColetasSvo: vi.fn(),
  avancarEtapaColetaSvo: vi.fn(),
}));

vi.mock("../../../src/contexts/auth", () => ({
  useAuth: () => ({ sessionKey: "test-session" }),
}));

vi.mock("../../../src/services/svo", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../src/services/svo")>();
  return {
    ...real,
    obterMinhasColetasSvo: mocks.obterMinhasColetasSvo,
    avancarEtapaColetaSvo: mocks.avancarEtapaColetaSvo,
  };
});

const coleta: MinhaColetaSvo = {
  id: "ordem-1",
  chamadoId: "chamado-1",
  veiculoId: "viatura-1",
  motoristaId: "motorista-1",
  status: "AGUARDANDO_DESPACHO",
  numeroDeclaracaoObito: null,
  dataHoraSaida: null,
  dataHoraChegadaLocal: null,
  dataHoraEntregaSvo: null,
  veiculo: {
    id: "viatura-1",
    placa: "QMA4J28",
    modelo: "S10 SVO",
    status: "DISPONIVEL",
    capacidadeMaxima: 4,
  },
  chamado: {
    id: "chamado-1",
    numeroProtocolo: "SVO-2026-0007",
    nomeFalecido: "Pessoa atendida",
    enderecoOcorrencia: "Rua das Flores, 100",
    criadoEm: "2026-11-10T12:00:00.000Z",
    statusTriagem: "APROVADO",
  },
};

describe("MinhasColetasSvoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obterMinhasColetasSvo.mockResolvedValue([coleta]);
    mocks.avancarEtapaColetaSvo.mockResolvedValue({ ...coleta, status: "EM_DESLOCAMENTO" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista as coletas atribuídas e percorre saída, chegada e entrega", async () => {
    mocks.obterMinhasColetasSvo
      .mockResolvedValueOnce([coleta])
      .mockResolvedValueOnce([{ ...coleta, status: "EM_DESLOCAMENTO" }])
      .mockResolvedValueOnce([{ ...coleta, status: "NO_LOCAL" }])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<MinhasColetasSvoPage />);
    expect(await screen.findByText("SVO-2026-0007")).toBeInTheDocument();
    expect(screen.getByText("Pessoa atendida")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, 100")).toBeInTheDocument();
    expect(screen.getByText(/SLA/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar saída" }));
    expect(mocks.avancarEtapaColetaSvo).toHaveBeenCalledWith("ordem-1", "EM_DESLOCAMENTO");
    expect(await screen.findByRole("button", { name: "Registrar chegada ao local" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Registrar chegada ao local" }));
    expect(mocks.avancarEtapaColetaSvo).toHaveBeenCalledWith("ordem-1", "NO_LOCAL");
    expect(await screen.findByRole("button", { name: "Registrar entrega ao SVO" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Registrar entrega ao SVO" }));
    expect(mocks.avancarEtapaColetaSvo).toHaveBeenCalledWith("ordem-1", "ENTREGUE_SVO");
    expect(await screen.findByRole("status")).toHaveTextContent("Coleta SVO-2026-0007 entregue");
    expect(
      await screen.findByText("Nenhuma coleta SVO ativa atribuída a você."),
    ).toBeInTheDocument();
  });

  it("permite tentar novamente quando a listagem falha", async () => {
    mocks.obterMinhasColetasSvo.mockRejectedValueOnce(new Error("Falha ao carregar coletas."));
    const user = userEvent.setup();
    render(<MinhasColetasSvoPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar coletas.");
    mocks.obterMinhasColetasSvo.mockResolvedValueOnce([]);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("Nenhuma coleta SVO ativa atribuída a você."),
    ).toBeInTheDocument();
  });

  it("bloqueia novo avanço até receber a etapa atualizada do servidor", async () => {
    let resolver!: (ordens: MinhaColetaSvo[]) => void;
    const atualizacao = new Promise<MinhaColetaSvo[]>((resolve) => {
      resolver = resolve;
    });
    mocks.obterMinhasColetasSvo.mockResolvedValueOnce([coleta]).mockReturnValueOnce(atualizacao);
    const user = userEvent.setup();
    render(<MinhasColetasSvoPage />);
    await user.click(await screen.findByRole("button", { name: "Registrar saída" }));
    expect(screen.getByRole("button", { name: "Registrar saída" })).toBeDisabled();
    expect(mocks.avancarEtapaColetaSvo).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolver([{ ...coleta, status: "EM_DESLOCAMENTO" }]);
    });
    expect(await screen.findByRole("button", { name: "Registrar chegada ao local" })).toBeEnabled();
  });

  it("atualiza as coletas em segundo plano sem esconder a lista", async () => {
    vi.useFakeTimers({ toFake: ["setInterval"] });
    mocks.obterMinhasColetasSvo
      .mockResolvedValueOnce([coleta])
      .mockResolvedValueOnce([{ ...coleta, status: "EM_DESLOCAMENTO" }]);
    render(<MinhasColetasSvoPage />);
    expect(await screen.findByRole("button", { name: "Registrar saída" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(
      await screen.findByRole("button", { name: "Registrar chegada ao local" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Carregando suas coletas SVO...")).not.toBeInTheDocument();
    expect(mocks.obterMinhasColetasSvo).toHaveBeenCalledTimes(2);
  });
});
