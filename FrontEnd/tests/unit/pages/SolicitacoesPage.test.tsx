import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { apiRequest } from "../../../src/lib/api";
import { SolicitacoesPage } from "../../../src/pages/solicitacoes/SolicitacoesPage";
import type { SolicitacaoViagem } from "../../../src/types/solicitacao";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const registro: SolicitacaoViagem = {
  id: "s1",
  protocolo: "SV-TESTE-001",
  solicitanteNome: "Pessoa de teste",
  setorOrigem: "LACEN",
  origem: "Sede",
  destino: "Hospital",
  dataHoraPretendida: null,
  quantidadePassageiros: 2,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Justificativa de teste",
  status: "PENDENTE",
  criadoEm: "2026-10-30T10:00:00Z",
};
const porStatus = { PENDENTE: 110, APROVADA: 3, EM_TRANSITO: 0, CONCLUIDA: 0, RECUSADA: 0 };
function resposta(page = 1) {
  return {
    data: [{ ...registro, protocolo: `SV-TESTE-00${page}` }],
    meta: { page, pageSize: 20, total: 113, totalPages: 6, porStatus },
  };
}
function renderPage(roles = ["GESTOR"]) {
  localStorage.setItem("@fsph_frota_token", "abc.def.ghi");
  localStorage.setItem(
    "@fsph_frota_user",
    JSON.stringify({ id: "teste", nome: "Pessoa de teste", email: "teste@example.test", roles }),
  );
  return render(
    <AuthProvider>
      <SolicitacoesPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (options?.method === "POST") return registro;
      const query = new URLSearchParams(path.split("?")[1]);
      if (query.get("pageSize") === "6")
        return {
          data: [{ ...registro, id: "urg", protocolo: "SV-URG-001", urgencia: "URGENTE" }],
          meta: { page: 1, pageSize: 6, total: 105, totalPages: 18, porStatus },
        };
      return resposta(Number(query.get("page")));
    });
});
describe("SolicitacoesPage", () => {
  it("exibe gestão, totais da API e fila urgente independente da página", async () => {
    renderPage();
    expect(await screen.findByText("SV-TESTE-001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /105 pedido/ })).toBeInTheDocument();
    expect(screen.getByText("113")).toBeInTheDocument();
    expect(screen.getByText("110")).toBeInTheDocument();
    expect(screen.getByText(/Exibindo 1 de 105/)).toBeInTheDocument();
  });
  it("consulta somente a listagem própria para solicitantes", async () => {
    renderPage(["SOLICITANTE"]);
    expect(
      screen.getByRole("heading", { name: "Minhas Solicitações de Viagem" }),
    ).toBeInTheDocument();
    await screen.findByText("SV-TESTE-001");
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Filtrar por setor")).not.toBeInTheDocument();
  });
  it("pagina e envia filtros combinados à API voltando à primeira página", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("SV-TESTE-001");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("SV-TESTE-002")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Aprovadas" }));
    await user.selectOptions(screen.getByLabelText("Filtrar por setor"), "Hemose");
    await user.selectOptions(screen.getByLabelText("Filtrar por urgência"), "URGENTE");
    fireEvent.change(screen.getByLabelText("Buscar solicitações"), {
      target: { value: " Hospital " },
    });
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/solicitacoes?page=1&pageSize=20&status=APROVADA%2CEM_TRANSITO&urgencia=URGENTE&setorOrigem=Hemose&busca=Hospital",
        { token: "abc.def.ghi" },
      ),
    );
  });
  it("reaplicar o mesmo filtro mantém a tela carregada", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("SV-TESTE-001");
    await user.click(screen.getByRole("tab", { name: "Todas" }));
    expect(screen.getByText("SV-TESTE-001")).toBeInTheDocument();
    expect(screen.queryByText("Carregando dados...")).not.toBeInTheDocument();
  });
  it("mostra falha da fila urgente mesmo com a tabela carregada", async () => {
    const original = vi.mocked(apiRequest).getMockImplementation()!;
    let falhar = true;
    vi.mocked(apiRequest).mockImplementation((path, options) =>
      path.includes("pageSize=6") && falhar
        ? Promise.reject(new Error("Falha exclusiva da fila"))
        : original(path, options),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("SV-TESTE-001");
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha exclusiva da fila");
    falhar = false;
    await user.click(screen.getByRole("button", { name: "Recarregar fila prioritária" }));
    expect(await screen.findByText("SV-URG-001")).toBeInTheDocument();
  });
  it("permite ver detalhes sem chamar rotas de aprovação inexistentes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("SV-TESTE-001");
    await user.click(
      screen.getByRole("button", { name: "Ver detalhes da solicitação SV-TESTE-001" }),
    );
    expect(screen.getByRole("button", { name: "Aprovar e Alocar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeDisabled();
    expect(
      vi
        .mocked(apiRequest)
        .mock.calls.every(([path]) => !path.includes("/aprovar") && !path.includes("/recusar")),
    ).toBe(true);
  });
  it("distingue falha na listagem de lista vazia e permite nova tentativa", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha na consulta"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha na consulta");
    expect(screen.getByText("Não foi possível carregar as solicitações.")).toBeInTheDocument();
    expect(screen.queryByText("113")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("SV-TESTE-001")).toBeInTheDocument();
  });
  it("preserva formulário após erro de envio e recarrega após sucesso", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);
    await screen.findByText("SV-TESTE-001");
    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.selectOptions(screen.getByLabelText(/^Setor solicitante/), "LACEN");
    await user.type(screen.getByLabelText(/^Origem/), "Sede FSPH");
    await user.type(screen.getByLabelText(/^Destino/), "Hospital de teste");
    const saida = new Date(Date.now() + 86400000);
    saida.setMinutes(saida.getMinutes() - saida.getTimezoneOffset());
    fireEvent.change(screen.getByLabelText(/^Data e hora de saída/), {
      target: { value: saida.toISOString().slice(0, 16) },
    });
    await user.type(
      screen.getByLabelText(/^Justificativa/),
      "Transporte institucional para exames",
    );
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Data de saída indisponível"));
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Data de saída indisponível");
    expect(screen.getByLabelText(/^Origem/)).toHaveValue("Sede FSPH");
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));
    expect(await screen.findByText(/Solicitação SV-TESTE-001 enviada!/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Origem/)).not.toBeInTheDocument();
  });
});
