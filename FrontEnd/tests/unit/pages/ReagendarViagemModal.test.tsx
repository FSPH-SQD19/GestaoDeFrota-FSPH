import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import { ReagendarViagemModal } from "../../../src/pages/solicitacoes/ReagendarViagemModal";
import type { SolicitacaoViagem } from "../../../src/types/solicitacao";

vi.mock("../../../src/lib/api", async (original) => ({
  ...(await original<typeof import("../../../src/lib/api")>()),
  apiRequest: vi.fn(),
}));
const solicitacao: SolicitacaoViagem = {
  id: "s1",
  protocolo: "SV-1",
  solicitanteNome: "Pessoa",
  setorOrigem: "Setor",
  origem: "Sede",
  destino: "Hospital",
  dataHoraPretendida: "2027-01-10T11:00:00Z",
  dataHoraRetornoPrevista: "2027-01-10T15:00:00Z",
  quantidadePassageiros: 2,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Teste de viagem",
  status: "APROVADA",
  criadoEm: "2026-01-01T12:00:00Z",
  veiculoAlocadoId: "v1",
  motoristaAlocadoId: "m1",
  veiculoAlocado: { placa: "ABC1234", modelo: "A" },
  motoristaAlocado: { nome: "Motorista atual" },
};
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") return {};
      if (path.startsWith("/veiculos"))
        return {
          data: [
            { id: "v1", placa: "ABC1234", modelo: "A", capacidadeMaxima: 4 },
            { id: "v2", placa: "DEF1234", modelo: "B", capacidadeMaxima: 4 },
          ],
          meta: { totalPages: 1 },
        };
      if (path === "/motoristas")
        return [
          { id: "m1", ativo: true, status: "DISPONIVEL", usuario: { nome: "Motorista atual" } },
          { id: "m2", ativo: true, status: "DISPONIVEL", usuario: { nome: "Novo motorista" } },
        ];
      throw new Error("Consulta inesperada");
    });
});
describe("ReagendarViagemModal", () => {
  it("altera recursos e envia horários de Brasília e motivo", async () => {
    const concluido = vi.fn();
    render(
      <ReagendarViagemModal
        solicitacao={solicitacao}
        sessionKey="sessao"
        onClose={vi.fn()}
        onConcluido={concluido}
      />,
    );
    await screen.findByRole("option", { name: /DEF1234/ });
    expect(screen.getByLabelText(/Saída prevista/)).toHaveValue("2027-01-10T08:00");
    fireEvent.change(screen.getByLabelText(/Veículo/), { target: { value: "v2" } });
    fireEvent.change(screen.getByLabelText(/Motorista/), { target: { value: "m2" } });
    fireEvent.change(screen.getByLabelText(/Motivo da alteração/), {
      target: { value: "Troca de equipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reagendamento" }));
    await waitFor(() => expect(concluido).toHaveBeenCalledOnce());
    expect(apiRequest).toHaveBeenCalledWith("/solicitacoes/s1/reagendar", {
      method: "PATCH",
      data: {
        veiculoId: "v2",
        motoristaId: "m2",
        inicio: "2027-01-10T11:00:00.000Z",
        fim: "2027-01-10T15:00:00.000Z",
        motivo: "Troca de equipe",
      },
    });
  });
  it("exige motivo antes de permitir salvar", async () => {
    render(
      <ReagendarViagemModal
        solicitacao={solicitacao}
        sessionKey="sessao"
        onClose={vi.fn()}
        onConcluido={vi.fn()}
      />,
    );
    await screen.findByRole("option", { name: /DEF1234/ });
    expect(screen.getByRole("button", { name: "Confirmar reagendamento" })).toBeDisabled();
  });
});
