import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsuariosPage } from "../../../src/pages/usuarios/UsuariosPage";
import { AuthProvider } from "../../helpers/auth";
import { setTestRoles } from "../../helpers/authState";
import { apiRequest } from "../../../src/lib/api";
import {
  atualizarUsuarioApi,
  criarUsuarioApi,
  inativarUsuarioApi,
  listarUsuariosApi,
  obterUsuarioApi,
} from "../../../src/services/usuariosService";
import { redefinirSenhaUsuarioApi } from "../../../src/services/perfilService";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("../../../src/services/usuariosService", () => ({
  atualizarUsuarioApi: vi.fn(),
  criarUsuarioApi: vi.fn(),
  inativarUsuarioApi: vi.fn(),
  listarUsuariosApi: vi.fn(),
  obterUsuarioApi: vi.fn(),
}));
vi.mock("../../../src/services/perfilService", () => ({
  redefinirSenhaUsuarioApi: vi.fn(),
}));

const usuario = {
  id: "usuario-1",
  nome: "Ana Souza",
  email: "ana@example.test",
  telefone: "(79) 99999-1234",
  setor: "LACEN",
  ativo: true,
  criadoEm: "2026-11-04T12:00:00.000Z",
  perfis: ["GESTOR" as const],
};

function renderPage(roles = ["ADMIN"]) {
  setTestRoles(roles);
  return render(
    <AuthProvider>
      <UsuariosPage />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockResolvedValue({
      usuario: { userId: "admin-test", perfis: ["ADMIN"] },
    });
  vi.mocked(listarUsuariosApi)
    .mockReset()
    .mockResolvedValue({
      data: [usuario],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  vi.mocked(obterUsuarioApi).mockReset().mockResolvedValue(usuario);
  vi.mocked(criarUsuarioApi).mockReset().mockResolvedValue({ mensagem: "Criado", dados: usuario });
  vi.mocked(atualizarUsuarioApi).mockReset().mockResolvedValue({
    mensagem: "Atualizado",
    dados: usuario,
  });
  vi.mocked(inativarUsuarioApi)
    .mockReset()
    .mockResolvedValue({
      mensagem: "Atualizado",
      dados: { ...usuario, ativo: false },
    });
  vi.mocked(redefinirSenhaUsuarioApi).mockReset().mockResolvedValue({ mensagem: "Redefinida" });
});

describe("UsuariosPage", () => {
  it("consulta o perfil e lista usuários reais com seus dados", async () => {
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("ana@example.test")).toBeInTheDocument();
    expect(screen.getAllByText("Gestor")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Novo usuário" })).toBeEnabled();
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/auth/perfil", {});
    expect(listarUsuariosApi).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it("filtra a lista pela busca e pelo status", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Souza");
    await user.type(screen.getByLabelText("Buscar usuário"), "ana");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(listarUsuariosApi).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        busca: "ana",
      }),
    );
    await user.selectOptions(screen.getByLabelText("Status"), "false");
    await waitFor(() =>
      expect(listarUsuariosApi).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        busca: "ana",
        ativo: false,
      }),
    );
  });

  it("cadastra usuário usando o endpoint de criação", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    await screen.findByRole("heading", { name: "Novo usuário" });
    expect(screen.queryByRole("checkbox", { name: "Motorista" })).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText(/^Nome/), "Bruna Lima");
    await user.type(await screen.findByLabelText(/^E-mail/), "bruna@example.test");
    await user.type(await screen.findByLabelText(/^Senha inicial/), "senha-segura");
    await user.type(await screen.findByLabelText("Telefone"), "79999991234");
    await user.type(await screen.findByLabelText("Setor"), "TI");
    await user.click(screen.getByLabelText("Solicitante"));
    await user.click(screen.getByRole("button", { name: "Salvar usuário" }));

    await waitFor(() =>
      expect(criarUsuarioApi).toHaveBeenCalledWith({
        nome: "Bruna Lima",
        email: "bruna@example.test",
        senha: "senha-segura",
        telefone: "79999991234",
        setor: "TI",
        perfis: ["SOLICITANTE"],
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Usuário cadastrado com sucesso.");
  });

  it("edita os dados e perfis do usuário", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Editar Ana Souza" }));
    await screen.findByRole("heading", { name: "Editar usuário" });
    const nome = await screen.findByLabelText(/^Nome/);
    await user.clear(nome);
    await user.type(nome, "Ana Atualizada");
    await user.click(screen.getByLabelText("Administrador"));
    await user.click(screen.getByRole("button", { name: "Salvar usuário" }));

    await waitFor(() =>
      expect(atualizarUsuarioApi).toHaveBeenCalledWith("usuario-1", {
        nome: "Ana Atualizada",
        email: "ana@example.test",
        telefone: "(79) 99999-1234",
        setor: "LACEN",
        perfis: ["GESTOR", "ADMIN"],
      }),
    );
  });

  it("não expõe nem remove o perfil MOTORISTA ao editar os dados da conta", async () => {
    const user = userEvent.setup();
    const contaMotorista = { ...usuario, perfis: ["MOTORISTA" as const, "GESTOR" as const] };
    vi.mocked(listarUsuariosApi).mockResolvedValue({
      data: [contaMotorista],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Editar Ana Souza" }));

    expect(screen.queryByRole("checkbox", { name: "Motorista" })).not.toBeInTheDocument();
    expect(screen.getByText(/O acesso de motorista desta conta será mantido/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar usuário" }));
    await waitFor(() =>
      expect(atualizarUsuarioApi).toHaveBeenCalledWith(
        "usuario-1",
        expect.objectContaining({ perfis: ["GESTOR", "MOTORISTA"] }),
      ),
    );
  });

  it("normaliza o perfil legado ATENDENTE_SVO ao exibir e editar a conta", async () => {
    const user = userEvent.setup();
    const contaLegada = { ...usuario, perfis: ["ATENDENTE_SVO" as const] };
    vi.mocked(listarUsuariosApi).mockResolvedValue({
      data: [contaLegada],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getAllByText("Atendente SVO")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Editar Ana Souza" }));
    expect(screen.getByLabelText("Atendente SVO")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Salvar usuário" }));
    await waitFor(() =>
      expect(atualizarUsuarioApi).toHaveBeenCalledWith(
        "usuario-1",
        expect.objectContaining({ perfis: ["SVO"] }),
      ),
    );
  });

  it("consulta e exibe os detalhes atualizados do usuário", async () => {
    const user = userEvent.setup();
    vi.mocked(obterUsuarioApi).mockResolvedValue({
      ...usuario,
      telefone: "(79) 98888-1111",
    });
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Ver detalhes de Ana Souza" }));

    expect(await screen.findByText("(79) 98888-1111")).toBeInTheDocument();
    expect(obterUsuarioApi).toHaveBeenCalledWith("usuario-1");
  });

  it("inativa a conta após confirmação", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Inativar Ana Souza" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(inativarUsuarioApi).toHaveBeenCalledWith("usuario-1", false));
  });

  it("bloqueia perfis sem permissão antes de chamar a API", () => {
    renderPage(["GESTOR"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso restrito a administradores.");
    expect(apiRequest).not.toHaveBeenCalled();
    expect(listarUsuariosApi).not.toHaveBeenCalled();
  });

  it("bloqueia a página quando a API não confirma o perfil administrador", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      usuario: { userId: "admin-test", perfis: ["GESTOR"] },
    });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acesso restrito a administradores.",
    );
    expect(listarUsuariosApi).not.toHaveBeenCalled();
  });

  it("mostra a falha ao carregar e permite tentar novamente", async () => {
    vi.mocked(listarUsuariosApi)
      .mockRejectedValueOnce(new Error("Falha de conexão"))
      .mockResolvedValueOnce({
        data: [usuario],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(listarUsuariosApi).toHaveBeenCalledTimes(2);
  });

  it("redefine a senha pela API administrativa", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Redefinir senha de Ana Souza" }));
    await screen.findByRole("heading", { name: "Redefinir senha" });
    await user.type(await screen.findByLabelText(/^Nova senha/), "senha-nova-segura");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
    await waitFor(() =>
      expect(redefinirSenhaUsuarioApi).toHaveBeenCalledWith("usuario-1", {
        novaSenha: "senha-nova-segura",
      }),
    );
  });
});
