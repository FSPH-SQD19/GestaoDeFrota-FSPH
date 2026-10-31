import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../src/contexts/auth";
import { Sidebar } from "../../../src/components/layout/Sidebar";
import { podeAcessar, telaInicial } from "../../../src/config/navigation";
import type { UserRole } from "../../../src/types/auth";

function renderSidebarWithRole(role: UserRole) {
  const user = {
    id: "usr-test",
    nome: "Usuário Teste",
    email: "teste@fsph.se.gov.br",
    roles: [role],
  };

  return render(
    <AuthContext.Provider
      value={{
        user,
        sessionKey: "sessionKey-test",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasRole: (required) => required.includes(role),
      }}
    >
      <Sidebar activeTab={telaInicial([role])} onSelectTab={vi.fn()} />
    </AuthContext.Provider>,
  );
}

describe("Navegação e Sidebar por perfil (RBAC)", () => {
  it("define a tela inicial correta para cada perfil", () => {
    expect(telaInicial(["ADMIN"])).toBe("dashboard");
    expect(telaInicial(["GESTOR"])).toBe("dashboard");
    expect(telaInicial(["SOLICITANTE"])).toBe("solicitacoes");
    expect(telaInicial(["MOTORISTA"])).toBe("viagens");
    expect(telaInicial(["SVO"])).toBe("svo");
  });

  it("bloqueia acesso ao dashboard para SOLICITANTE, MOTORISTA e SVO", () => {
    expect(podeAcessar("dashboard", ["SOLICITANTE"])).toBe(false);
    expect(podeAcessar("dashboard", ["MOTORISTA"])).toBe(false);
    expect(podeAcessar("dashboard", ["SVO"])).toBe(false);
    expect(podeAcessar("dashboard", ["GESTOR"])).toBe(true);
    expect(podeAcessar("dashboard", ["ADMIN"])).toBe(true);
  });

  it('exibe apenas "Minhas Solicitações" para SOLICITANTE (sem Dashboard)', () => {
    renderSidebarWithRole("SOLICITANTE");

    expect(screen.getByRole("button", { name: "Minhas Solicitações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /veículos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /módulo svo/i })).not.toBeInTheDocument();
  });

  it('exibe apenas "Minhas Viagens" para MOTORISTA (sem Dashboard)', () => {
    renderSidebarWithRole("MOTORISTA");

    expect(screen.getByRole("button", { name: "Minhas Viagens" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solicitações/i })).not.toBeInTheDocument();
  });

  it('exibe apenas "Módulo SVO" para SVO (segregação de frotas)', () => {
    renderSidebarWithRole("SVO");

    expect(screen.getByRole("button", { name: "Módulo SVO" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /veículos/i })).not.toBeInTheDocument();
  });

  it("exibe módulos de frota administrativa para GESTOR e oculta SVO e Usuários", () => {
    renderSidebarWithRole("GESTOR");

    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /solicitações/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /veículos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /motoristas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /relatórios/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /módulo svo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /usuários/i })).not.toBeInTheDocument();
  });
});
