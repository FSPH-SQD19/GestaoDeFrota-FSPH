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
  capacidadeMaxima: 4,
  combustivel: null,
  ano: null,
  status: "DISPONIVEL",
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
      if (options?.method === "POST") return veiculo;
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
        body: JSON.stringify({
          placa: "ABC1234",
          modelo: "Modelo válido",
          tipoFrota: "ADMINISTRATIVA",
          capacidadeMaxima: 4,
        }),
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
