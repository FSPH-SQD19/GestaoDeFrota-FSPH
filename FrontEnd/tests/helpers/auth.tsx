import type { ReactNode } from "react";
import { vi } from "vitest";
import { AuthContext } from "../../src/contexts/auth";
import { getTestRoles } from "./authState";
export function AuthProvider({ children }: { children: ReactNode }) {
  const roles = getTestRoles();
  return (
    <AuthContext.Provider
      value={{
        user: { id: "teste", nome: "Pessoa de teste", email: "teste@example.test", roles },
        sessionKey: "sessao-de-teste",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasRole: (required) => !required.length || roles.some((role) => required.includes(role)),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
