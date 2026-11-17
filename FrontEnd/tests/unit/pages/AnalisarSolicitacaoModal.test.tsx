import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import { AnalisarSolicitacaoModal } from "../../../src/pages/solicitacoes/AnalisarSolicitacaoModal";
import type { SolicitacaoViagem } from "../../../src/types/solicitacao";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const saidaFutura = new Date(Date.now() + 48 * 60 * 60 * 1000);
const retornoFuturo = new Date(saidaFutura.getTime() + 10 * 60 * 60 * 1000);
const solicitacao: SolicitacaoViagem = {
  id: "s1",
  protocolo: "SV-TESTE",
  solicitanteNome: "Pessoa de teste",
  setorOrigem: "LACEN",
  origem: "Sede",
  destino: "Hospital",
  dataHoraPretendida: saidaFutura.toISOString(),
  dataHoraRetornoPrevista: retornoFuturo.toISOString(),
  quantidadePassageiros: 3,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Transporte institucional",
  status: "PENDENTE",
  criadoEm: "2026-10-30T10:00:00Z",
};
const veiculo = {
  id: "v1",
  placa: "ABC1234",
  modelo: "Modelo",
  ativo: true,
  tipoFrota: "ADMINISTRATIVA",
  status: "DISPONIVEL",
  capacidadeMaxima: 2,
};
const motorista = {
  id: "m1",
  cpf: "12345678909",
  ativo: true,
  status: "DISPONIVEL",
  validadeCnh: "2099-11-10T00:00:00Z",
  usuario: { nome: "Condutor válido" },
};
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (options?.method === "PATCH") return { dados: {} };
      if (path === "/motoristas")
        return [
          motorista,
          { ...motorista, id: "m2", status: "EM_ROTA", usuario: { nome: "Condutor em rota" } },
          {
            ...motorista,
            id: "m3",
            validadeCnh: "2026-11-09",
            usuario: { nome: "Condutor vencido" },
          },
        ];
      return {
        data: path.includes("page=2")
          ? [{ ...veiculo, id: "v2", placa: "DEF5678", capacidadeMaxima: 4 }]
          : [veiculo],
        meta: { totalPages: 2 },
      };
    });
});
const concluir = vi.fn(),
  fechar = vi.fn();
function renderModal(modo: "APROVAR" | "RECUSAR" = "APROVAR", dados = solicitacao) {
  return render(
    <AnalisarSolicitacaoModal
      solicitacao={dados}
      sessionKey="sessionKey-teste"
      modo={modo}
      onClose={fechar}
      onConcluido={concluir}
    />,
  );
}
async function selecionar(user: ReturnType<typeof userEvent.setup>, veiculo = "v2") {
  await screen.findByRole("option", { name: /DEF5678/ });
  await user.selectOptions(screen.getByLabelText("Veículo administrativo"), veiculo);
  await user.selectOptions(screen.getByLabelText("Motorista"), "m1");
}
describe("AnalisarSolicitacaoModal", () => {
  it("pagina os veículos e filtra motorista pela disponibilidade e data local do retorno", async () => {
    renderModal();
    await screen.findByRole("option", { name: /DEF5678/ });
    expect(screen.getByRole("option", { name: "Condutor válido" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Condutor em rota" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Condutor vencido" })).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      "/veiculos?page=2&pageSize=100&tipoFrota=ADMINISTRATIVA&status=DISPONIVEL",
      {},
    );
  });
  it("confere a capacidade antes de enviar", async () => {
    const user = userEvent.setup();
    renderModal();
    await selecionar(user, "v1");
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Capacidade do veículo insuficiente");
    expect(vi.mocked(apiRequest).mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(false);
  });
  it("preserva seleções após conflito e permite nova tentativa", async () => {
    const user = userEvent.setup();
    renderModal();
    await selecionar(user);
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("Veículo já possui viagem neste horário."),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já possui viagem");
    expect(screen.getByLabelText("Veículo administrativo")).toHaveValue("v2");
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    expect(apiRequest).toHaveBeenLastCalledWith("/solicitacoes/s1/aprovar", {
      method: "PATCH",
      data: { veiculoId: "v2", motoristaId: "m1" },
    });
    expect(concluir).toHaveBeenCalledWith("Solicitação SV-TESTE aprovada e alocada.");
  });
  it("permite informar retorno para aprovar solicitação sem intervalo completo", async () => {
    const user = userEvent.setup();
    renderModal("APROVAR", { ...solicitacao, dataHoraRetornoPrevista: null });
    expect(screen.getByRole("button", { name: "Confirmar aprovação" })).toBeDisabled();
    const retorno = new Date(saidaFutura.getTime() + 12 * 60 * 60 * 1000);
    const retornoLocal = new Date(retorno.getTime() - retorno.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    fireEvent.change(screen.getByLabelText(/Retorno previsto para alocação/), {
      target: { value: retornoLocal },
    });
    await selecionar(user);
    await user.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    expect(apiRequest).toHaveBeenLastCalledWith("/solicitacoes/s1/aprovar", {
      method: "PATCH",
      data: {
        veiculoId: "v2",
        motoristaId: "m1",
        dataHoraRetornoPrevista: new Date(retornoLocal).toISOString(),
      },
    });
  });
  it("bloqueia aprovação quando a saída da solicitação já passou", () => {
    renderModal("APROVAR", {
      ...solicitacao,
      dataHoraPretendida: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(screen.getByRole("button", { name: "Confirmar aprovação" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("exige uma saída futura");
  });
  it("recusa sem carregar recursos e envia o motivo normalizado", async () => {
    const user = userEvent.setup();
    renderModal("RECUSAR");
    expect(apiRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o motivo");
    fireEvent.change(screen.getByLabelText(/^Motivo da recusa/), {
      target: { value: " Sem disponibilidade " },
    });
    await user.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/solicitacoes/s1/recusar", {
      method: "PATCH",
      data: { motivoRecusa: "Sem disponibilidade" },
    });
  });
  it("bloqueia fechamento e novo envio durante a decisão", async () => {
    const user = userEvent.setup();
    renderModal("RECUSAR");
    fireEvent.change(screen.getByLabelText(/^Motivo da recusa/), {
      target: { value: "Sem recursos" },
    });
    vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(fechar).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Motivo da recusa/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it("oferece nova tentativa se o carregamento de recursos falha", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha nos recursos"));
    const user = userEvent.setup();
    renderModal();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha nos recursos");
    await user.click(screen.getByRole("button", { name: "Recarregar recursos" }));
    expect(await screen.findByRole("option", { name: /DEF5678/ })).toBeInTheDocument();
  });
});
