import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsuariosPage } from "../../../src/pages/usuarios/UsuariosPage";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { apiRequest } from "../../../src/lib/api";
vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));
function renderPage(roles = ["ADMIN"]) {
  localStorage.setItem("@fsph_frota_token", "abc.def.ghi");
  localStorage.setItem(
    "@fsph_frota_user",
    JSON.stringify({
      id: "admin-test",
      nome: "Administrador de teste",
      email: "admin@example.test",
      roles,
    }),
  );
  return render(
    <AuthProvider>
      <UsuariosPage />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockResolvedValue({ usuario: { userId: "admin-test", perfis: ["ADMIN"] } });
});
describe("UsuariosPage", () => {
  it("informa a ausência de gestão de usuários sem simular listagem ou cadastro", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Usuários" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gestão de usuários indisponível" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo usuário" })).toBeDisabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(await screen.findByText("admin-test")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/auth/perfil", { token: "abc.def.ghi" });
  });
  it("exibe apenas os perfis retornados pela API existente", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      usuario: { userId: "id-real", perfis: ["ADMIN", "GESTOR"] },
    });
    renderPage();
    expect(await screen.findByText("id-real")).toBeInTheDocument();
    expect(screen.getByText("Administrador, Gestor")).toBeInTheDocument();
  });
  it("mostra a falha e permite consultar novamente", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Falha de conexão"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    await user.click(screen.getByRole("button", { name: "Verificar acesso" }));
    expect(await screen.findByText("admin-test")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it("bloqueia perfis sem permissão antes de consultar", () => {
    renderPage(["GESTOR"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso restrito a administradores.");
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("bloqueia o conteúdo quando a API não confirma o perfil administrador", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      usuario: { userId: "admin-test", perfis: ["GESTOR"] },
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Acesso restrito a administradores."),
    );
    expect(screen.queryByRole("heading", { name: "Seu acesso" })).not.toBeInTheDocument();
  });
});
