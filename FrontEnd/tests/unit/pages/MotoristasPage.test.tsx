import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { apiRequest } from "../../../src/lib/api";
import { MotoristasPage } from "../../../src/pages/motorista/MotoristaPage";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 86400000)
  .toISOString()
  .slice(0, 10);
const motorista = {
  id: "m1",
  cpf: "12345678909",
  numeroCnh: "12345678901",
  categoriaCnh: "B",
  validadeCnh: hoje,
  ativo: true,
  status: "EM_VIAGEM",
  telefone: "(79) 99999-1234",
  usuario: { nome: "Condutor Hoje", email: "condutor@example.test" },
};
const lista = [
  motorista,
  {
    ...motorista,
    id: "m2",
    validadeCnh: ontem,
    usuario: { nome: "Condutor Vencido", email: "vencido@example.test" },
  },
  { ...motorista, id: "m3", ativo: false, validadeCnh: ontem, status: "INATIVO", usuario: null },
];
function renderPage() {
  localStorage.setItem("@fsph_frota_token", "abc.def.ghi");
  localStorage.setItem(
    "@fsph_frota_user",
    JSON.stringify({
      id: "gestor",
      nome: "Gestor",
      email: "gestor@example.test",
      roles: ["GESTOR"],
    }),
  );
  return render(
    <AuthProvider>
      <MotoristasPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue(lista);
});
async function preencher() {
  fireEvent.change(screen.getByLabelText(/^Nome completo/), {
    target: { value: " Novo Condutor " },
  });
  fireEvent.change(screen.getByLabelText(/^E-mail de acesso/), {
    target: { value: "NOVO@example.test" },
  });
  fireEvent.change(screen.getByLabelText(/^Senha inicial/), { target: { value: "senha123" } });
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: "12345678909" } });
  fireEvent.change(screen.getByLabelText(/^Número da CNH/), { target: { value: "12345678901" } });
  fireEvent.change(screen.getByLabelText(/^Categoria da CNH/), { target: { value: "B" } });
  fireEvent.change(screen.getByLabelText(/^Validade da CNH/), { target: { value: hoje } });
  fireEvent.change(screen.getByLabelText(/^Telefone para contato/), {
    target: { value: "(79) 99999-1234" },
  });
}
describe("MotoristasPage", () => {
  it("consulta a API e distingue CNH válida hoje de vencida e cadastro inativo", async () => {
    renderPage();
    await screen.findByText("Condutor Hoje");
    const linhaHoje = screen.getByText("Condutor Hoje").closest("tr")!;
    expect(within(linhaHoje).getByText("Próxima")).toBeInTheDocument();
    expect(within(linhaHoje).queryByText("Vencida")).not.toBeInTheDocument();
    expect(screen.getAllByText("Em viagem")).toHaveLength(2);
    expect(apiRequest).toHaveBeenCalledWith("/motoristas", { token: "abc.def.ghi" });
  });
  it("filtra CNHs vencendo sem incluir as vencidas e permite consultar detalhes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Condutor Hoje");
    await user.click(screen.getByRole("button", { name: /CNHs vencendo em até 30 dias/ }));
    expect(screen.getByText("Condutor Hoje")).toBeInTheDocument();
    expect(screen.queryByText("Condutor Vencido")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver detalhes de Condutor Hoje" }));
    expect(screen.getByRole("heading", { name: "Dados do motorista" })).toBeInTheDocument();
  });
  it("filtra status de cadastro sem confundir com status operacional", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Condutor Hoje");
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.selectOptions(screen.getByLabelText("Status do cadastro"), "Inativo");
    expect(screen.queryByText("Condutor Hoje")).not.toBeInTheDocument();
    expect(screen.getByText("Usuário sem vínculo")).toBeInTheDocument();
  });
  it("apresenta falhas com nova tentativa e não inventa uma lista vazia", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha na consulta"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha na consulta");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Condutor Hoje")).toBeInTheDocument();
  });
  it("preserva o formulário após conflito e recarrega após cadastrar", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Condutor Hoje");
    await user.click(screen.getByRole("button", { name: "Novo motorista" }));
    await preencher();
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("E-mail, CPF ou CNH já cadastrado."));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já cadastrado");
    expect(screen.getByLabelText(/^Nome completo/)).toHaveValue(" Novo Condutor ");
    vi.mocked(apiRequest).mockResolvedValueOnce(motorista);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Motorista e conta de acesso cadastrados.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Senha inicial/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenLastCalledWith("/motoristas", { token: "abc.def.ghi" }),
    );
    const envio = vi
      .mocked(apiRequest)
      .mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(JSON.parse(envio[1]!.body!)).toMatchObject({
      nome: "Novo Condutor",
      email: "novo@example.test",
      cpf: "12345678909",
      telefone: "79999991234",
    });
  });
  it("bloqueia fechamento e edição enquanto o cadastro está pendente", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Condutor Hoje");
    await user.click(screen.getByRole("button", { name: "Novo motorista" }));
    await preencher();
    vi.mocked(apiRequest).mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByLabelText(/^Senha inicial/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(
      vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
  });
});
