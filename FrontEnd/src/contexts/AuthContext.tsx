import React, { useState } from "react";
import type { User, UserRole, LoginCredentials, AuthState } from "../types/auth";
import { apiRequest } from "../lib/api";
import { AuthContext } from "./auth";

const STORAGE_KEY_USER = "@fsph_frota_user";
const STORAGE_KEY_TOKEN = "@fsph_frota_token";

const validRoles = new Set<UserRole>([
  "ADMIN",
  "GESTOR",
  "MOTORISTA",
  "ATENDENTE_SVO",
  "SOLICITANTE",
]);

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  } catch {
    // A sessão em memória continua funcionando quando o navegador bloqueia o armazenamento.
  }
}

function saveSession(user: User, token: string) {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } catch {
    // O usuário precisará entrar novamente após recarregar a página.
  }
}

function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function isStoredUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<User>;
  return (
    typeof user.id === "string" &&
    typeof user.nome === "string" &&
    typeof user.email === "string" &&
    Array.isArray(user.roles) &&
    user.roles.length > 0 &&
    user.roles.every((role) => validRoles.has(role))
  );
}

function readSession(): AuthState {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (storedUser && storedToken && isTokenShape(storedToken)) {
      const user: unknown = JSON.parse(storedUser);
      if (isStoredUser(user)) {
        return { user, token: storedToken, isAuthenticated: true, isLoading: false };
      }
    }
  } catch {
    // JSON inválido ou armazenamento indisponível: voltar ao login.
  }
  clearSession();
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  };
}

interface LoginResponse {
  token: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    perfis: string[];
  };
}

function mapRole(perfil: string): UserRole | null {
  if (perfil === "SVO") return "ATENDENTE_SVO";
  return validRoles.has(perfil as UserRole) ? (perfil as UserRole) : null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(readSession);

  const login = async ({ usuario, senha }: LoginCredentials) => {
    const result = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: usuario.trim(), senha }),
    });
    const roles = result.usuario.perfis.map(mapRole).filter((role): role is UserRole => role !== null);

    if (!result.token || !result.usuario.id || roles.length === 0) {
      throw new Error("A resposta de autenticação não contém um perfil de acesso válido.");
    }

    const user: User = {
      id: result.usuario.id,
      nome: result.usuario.nome,
      email: result.usuario.email,
      roles,
    };

    saveSession(user, result.token);
    setState({ user, token: result.token, isAuthenticated: true, isLoading: false });
  };

  const logout = () => {
    clearSession();
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  };

  const hasRole = (requiredRoles: UserRole[]): boolean => {
    if (!state.user) return false;
    if (requiredRoles.length === 0) return true;
    return state.user.roles.some((role) => requiredRoles.includes(role));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
