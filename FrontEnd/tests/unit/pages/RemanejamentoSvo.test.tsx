import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RemanejamentoSvo } from "../../../src/pages/svo/RemanejamentoSvo";
import type { OrdemColetaSvo } from "../../../src/services/svo";
const mocks = vi.hoisted(() => ({ salvar: vi.fn(), historico: vi.fn() }));
vi.mock("../../../src/services/svo", () => ({
  remanejarOrdemSvo: mocks.salvar,
  obterRemanejamentosSvo: mocks.historico,
  extrairErroSvo: () => "Capacidade atingida",
}));
const ordem: OrdemColetaSvo = {
  id: "ordem",
  chamadoId: "chamado",
  veiculoId: "v1",
  motoristaId: "m1",
  status: "NO_LOCAL",
  numeroDeclaracaoObito: null,
  dataHoraSaida: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.historico.mockResolvedValue([]);
});
it("exige motivo e uma troca e preserva formulário após conflito", async () => {
  mocks.salvar.mockRejectedValue(new Error("conflito"));
  const concluido = vi.fn();
  render(
    <RemanejamentoSvo
      ordem={ordem}
      viaturas={[
        {
          id: "v2",
          placa: "NOVA",
          modelo: "S10",
          status: "DISPONIVEL",
          capacidadeMaxima: 2,
          ativo: true,
          ocupacaoAtual: 0,
          motoristaAtual: null,
        },
      ]}
      motoristas={[]}
      onConcluido={concluido}
    />,
  );
  const botao = screen.getByRole("button", { name: "Confirmar remanejamento" });
  expect(botao).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Viatura de destino"), { target: { value: "v2" } });
  fireEvent.change(screen.getByLabelText("Motivo do remanejamento"), {
    target: { value: "Pane na viatura" },
  });
  fireEvent.click(botao);
  await waitFor(() =>
    expect(mocks.salvar).toHaveBeenCalledWith("ordem", {
      veiculoId: "v2",
      motoristaId: "m1",
      motivo: "Pane na viatura",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Capacidade atingida");
  expect(concluido).not.toHaveBeenCalled();
});
it("oculta troca em ordem encerrada e exibe histórico", async () => {
  mocks.historico.mockResolvedValue([
    {
      id: "h",
      criadoEm: "2026-11-11T12:00:00Z",
      usuario: { nome: "Operador" },
      dadosNovos: { motivo: "Pane", anterior: { placa: "ANTIGA" }, atual: { placa: "NOVA" } },
    },
  ]);
  render(
    <RemanejamentoSvo
      ordem={{ ...ordem, status: "ENTREGUE_SVO" }}
      viaturas={[]}
      motoristas={[]}
      onConcluido={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(await screen.findByText("Motivo: Pane")).toBeInTheDocument();
});
