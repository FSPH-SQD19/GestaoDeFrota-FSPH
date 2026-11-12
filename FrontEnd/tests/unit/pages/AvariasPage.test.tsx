import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvariasPage } from "../../../src/pages/avarias/AvariasPage";
import type { AvariaViagem } from "../../../src/services/avariasService";

const mocks = vi.hoisted(() => ({
  listarAvarias: vi.fn(),
  listarVeiculos: vi.fn(),
  obterHistorico: vi.fn(),
  analisarAvaria: vi.fn(),
}));

vi.mock("../../../src/services/avariasService", () => ({
  listarAvarias: mocks.listarAvarias,
  listarVeiculosComAvaria: mocks.listarVeiculos,
  obterHistoricoAvaria: mocks.obterHistorico,
  analisarAvariaApi: mocks.analisarAvaria,
}));

const avaria: AvariaViagem = {
  id: "avaria-1",
  solicitacaoId: "viagem-1",
  execucaoId: "execucao-1",
  veiculoId: "veiculo-1",
  registradaPorId: "motorista-1",
  analisadaPorId: null,
  descricao: "Avaria na porta lateral",
  situacao: "PENDENTE",
  criadaEm: "2026-11-12T12:00:00.000Z",
  analisadaEm: null,
  justificativa: null,
  veiculo: { id: "veiculo-1", placa: "ABC1234", modelo: "Van", status: "MANUTENCAO", ativo: true },
  solicitacao: { id: "viagem-1", protocolo: "V-2026-001", origem: "Sede", destino: "Hospital" },
  registradaPor: { id: "motorista-1", nome: "Mariana Motorista" },
  analisadaPor: null,
  manutencao: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listarAvarias.mockResolvedValue({
    data: [avaria],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  mocks.listarVeiculos.mockResolvedValue([{ id: "veiculo-1", placa: "ABC1234", modelo: "Van" }]);
  mocks.obterHistorico.mockResolvedValue([
    {
      id: "history-1",
      situacaoAnterior: null,
      situacaoNova: "PENDENTE",
      justificativa: "Avaria registrada no checklist de retorno.",
      criadoEm: "2026-11-12T12:00:00.000Z",
      autor: { id: "motorista-1", nome: "Mariana Motorista" },
      manutencao: null,
    },
  ]);
  mocks.analisarAvaria.mockResolvedValue({ ...avaria, situacao: "LIBERADA" });
});

describe("AvariasPage", () => {
  it("exibe a fila, filtra por situação e apresenta o responsável pendente", async () => {
    const user = userEvent.setup();
    render(<AvariasPage />);
    expect(await screen.findByText("Avaria na porta lateral")).toBeInTheDocument();
    expect(screen.getByText("Aguardando responsável pela análise")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Situação"), "PENDENTE");
    await waitFor(() =>
      expect(mocks.listarAvarias).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        situacao: "PENDENTE",
      }),
    );
  });

  it("exige justificativa e envia decisão de encaminhamento à manutenção", async () => {
    const user = userEvent.setup();
    render(<AvariasPage />);
    await screen.findByText("Avaria na porta lateral");
    await user.click(screen.getByRole("button", { name: "Encaminhar para manutenção" }));
    await user.click(screen.getByRole("button", { name: "Confirmar decisão" }));
    expect(
      screen.getByText("Informe uma justificativa com pelo menos 5 caracteres."),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/^Justificativa da avaliação/),
      "Reparo antes de liberar.",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar decisão" }));
    await waitFor(() =>
      expect(mocks.analisarAvaria).toHaveBeenCalledWith("avaria-1", {
        decisao: "ENCAMINHAR_MANUTENCAO",
        justificativa: "Reparo antes de liberar.",
      }),
    );
  });

  it("carrega e mostra o histórico da ocorrência", async () => {
    const user = userEvent.setup();
    render(<AvariasPage />);
    await screen.findByText("Avaria na porta lateral");
    await user.click(screen.getByRole("button", { name: "Ver histórico" }));
    expect(
      await screen.findByText("Avaria registrada no checklist de retorno."),
    ).toBeInTheDocument();
    expect(mocks.obterHistorico).toHaveBeenCalledWith("avaria-1");
  });
});
