import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { apiRequest } from "../../../src/lib/api";
import { VeiculosPage } from "../../../src/pages/veiculos/VeiculosPage";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const veiculo = {
  id: "v1",
  placa: "ABC1234",
  modelo: "Modelo de teste",
  tipoFrota: "ADMINISTRATIVA",
  propriedade: "PROPRIO",
  fornecedorId: null,
  capacidadeMaxima: 4,
  combustivel: null,
  ano: null,
  status: "DISPONIVEL",
};
const locadora = {
  id: "00000000-0000-4000-8000-0000000000f1",
  razaoSocial: "Locadora DEMO",
  tipoServico: "LOCADORA",
  ativo: true,
};
const resposta = (page = 1) => ({
  data: [{ ...veiculo, id: `v${page}`, placa: page === 1 ? "ABC1234" : "DEF5678" }],
  meta: { page, pageSize: 10, total: 112, totalPages: 12 },
});
function renderPage() {
  return render(
    <AuthProvider>
      <VeiculosPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        if (String(path).includes("/documentos")) {
          return {
            id: "doc-1",
            tipoDocumento: "CRLV",
            dataVencimento: "2027-03-31",
            situacao: "VIGENTE",
            atual: true,
            diasParaVencer: 120,
          };
        }
        return veiculo;
      }
      if (path === "/sedes") return { data: [] };
      if (path === "/fornecedores") return { total: 1, dados: [locadora] };
      if (String(path).includes("/documentos")) {
        return { data: [], resumo: { tiposSemRegistro: ["CRLV", "IPVA", "SEGURO", "VISTORIA"] } };
      }
      const params = new URLSearchParams(path.split("?")[1]);
      if (params.get("pageSize") === "1")
        return {
          data: [],
          meta: {
            total:
              params.get("tipoFrota") === "SVO"
                ? 12
                : params.get("tipoFrota") === "ADMINISTRATIVA"
                  ? 100
                  : 112,
          },
        };
      return resposta(Number(params.get("page")));
    });
});
describe("VeiculosPage", () => {
  it("filtra sem sede e fora de sede pela API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.selectOptions(screen.getByLabelText("Filtrar por sede"), "SEM_SEDE");
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("sede=SEM_SEDE"), {}),
    );
    await user.selectOptions(screen.getByLabelText("Filtrar por sede"), "FORA_DE_SEDE");
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("sede=FORA_DE_SEDE"), {}),
    );
  });
  it("edita a sede exibindo o status operacional", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.click(screen.getByRole("button", { name: "Detalhes / Editar sede" }));
    expect(screen.getByText("Status operacional: Dispon\u00edvel")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Sede atual"), "FORA_DE_SEDE");
    await user.click(screen.getByRole("button", { name: "Salvar sede" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/veiculos/v1", {
        method: "PATCH",
        data: { sedeId: null, foraDeSede: true },
      }),
    );
  });

  it("abre documentos pelo veículo e permite repetir a consulta após erro", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha ao consultar documentos."));
    await user.click(screen.getByRole("button", { name: "Ver documentos do veículo ABC1234" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao consultar documentos.");
    expect(apiRequest).toHaveBeenLastCalledWith("/veiculos/v1/documentos");
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: [
        {
          id: "atual",
          tipoDocumento: "IPVA",
          dataVencimento: "2026-11-08",
          atual: true,
          situacao: "PROXIMO_VENCIMENTO",
          diasParaVencer: 0,
        },
        {
          id: "antigo",
          tipoDocumento: "CRLV",
          dataVencimento: "2026-10-01",
          atual: false,
          situacao: "VENCIDO",
          diasParaVencer: -10,
        },
        {
          id: "renovado",
          tipoDocumento: "CRLV",
          dataVencimento: "2027-11-08",
          atual: true,
          situacao: "VIGENTE",
          diasParaVencer: 365,
        },
      ],
      resumo: { tiposSemRegistro: ["SEGURO", "VISTORIA"] },
    });
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Vence hoje")).toBeInTheDocument();
    expect(screen.queryByText("Vencido há 10 dia(s)")).not.toBeInTheDocument();
    expect(screen.getByText("Documentos atuais")).toBeInTheDocument();
    expect(screen.getByText("Cadastrar ou renovar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Alertas de vencimento")).not.toBeInTheDocument();
  });

  it("cadastra documento pelo modal do veículo", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.click(screen.getByRole("button", { name: "Ver documentos do veículo ABC1234" }));
    expect(await screen.findByText("Cadastrar ou renovar")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Tipo de documento/), "VISTORIA");
    fireEvent.change(screen.getByLabelText(/^Data de vencimento/), {
      target: { value: "2027-03-31" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar documento" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/veiculos/v1/documentos",
        expect.objectContaining({
          method: "POST",
          data: { tipoDocumento: "VISTORIA", dataVencimento: "2027-03-31" },
        }),
      ),
    );
    expect(await screen.findByText("Documento registrado.")).toBeInTheDocument();
  });

  it("exige locadora ao cadastrar veículo locado", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    expect(screen.getByText("Próprio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Novo Veículo" }));
    await user.type(screen.getByLabelText(/^Placa/), "ABC1234");
    await user.type(screen.getByLabelText(/^Modelo e fabricante/), "Modelo válido");
    await user.selectOptions(screen.getByLabelText("Propriedade"), "LOCADO");
    expect(await screen.findByLabelText("Locadora")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecione a locadora");
    await user.selectOptions(screen.getByLabelText("Locadora"), locadora.id);
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/veiculos",
        expect.objectContaining({
          method: "POST",
          data: expect.objectContaining({
            propriedade: "LOCADO",
            fornecedorId: locadora.id,
          }),
        }),
      ),
    );
  });

  it("usa os totais da API e pagina além da primeira centena de veículos", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("ABC1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administrativa (100)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SVO (12)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText("DEF5678")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/veiculos?page=2&pageSize=10", {});
    await user.click(screen.getByRole("button", { name: "SVO (12)" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/veiculos?page=1&pageSize=10&tipoFrota=SVO", {}),
    );
  });
  it("envia busca ao servidor e volta à primeira página", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("DEF5678");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar veículo" }), {
      target: { value: "ABC" },
    });
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/veiculos?page=1&pageSize=10&busca=ABC", {}),
    );
  });
  it("valida antes de enviar o cadastro e conserva os dados após rejeição da API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.click(screen.getByRole("button", { name: "Novo Veículo" }));
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Placa inválida");
    expect(vi.mocked(apiRequest).mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    await user.type(screen.getByLabelText(/^Placa/), "abc-1234");
    await user.type(screen.getByLabelText(/^Modelo e fabricante/), "Modelo válido");
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Placa já cadastrada."));
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Placa já cadastrada.");
    expect(screen.getByLabelText(/^Placa/)).toHaveValue("abc-1234");
    expect(apiRequest).toHaveBeenLastCalledWith(
      "/veiculos",
      expect.objectContaining({
        method: "POST",
        data: {
          sedeId: null,
          foraDeSede: false,
          placa: "ABC1234",
          modelo: "Modelo válido",
          tipoFrota: "ADMINISTRATIVA",
          propriedade: "PROPRIO",
          capacidadeMaxima: 4,
        },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    expect(await screen.findByText("Veículo ABC1234 cadastrado.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Placa/)).not.toBeInTheDocument();
  });
  it("mostra falhas da listagem sem tratá-las como ausência de registros", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha na listagem"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha na listagem");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("ABC1234")).toBeInTheDocument();
  });
  it("não permite fechar nem enviar novamente enquanto o cadastro está pendente", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("ABC1234");
    await user.click(screen.getByRole("button", { name: "Novo Veículo" }));
    await user.type(screen.getByLabelText(/^Placa/), "ABC1234");
    await user.type(screen.getByLabelText(/^Modelo e fabricante/), "Modelo válido");
    vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByRole("button", { name: "Salvar veículo" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByLabelText(/^Placa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(
      1,
    );
  });
});
