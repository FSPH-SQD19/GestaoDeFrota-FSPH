import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { User, UserRole, LoginCredentials, AuthState } from "../types/auth";
import {
  api,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  setUnauthorizedHandler,
} from "../services/api";
import { AuthContext } from "./auth";

const validRoles = new Set<UserRole>(["ADMIN", "GESTOR", "MOTORISTA", "SVO", "SOLICITANTE"]);

interface LoginApiResponse {
  token: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    perfis: string[];
  };
}

function clearSession() {
  clearAuthSession();
}

function saveSession(user: User, token: string) {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // O usuário precisará entrar novamente após recarregar a página.
  }
}

function isTokenShape(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function mapPerfis(perfis: string[]): UserRole[] {
  const roles = perfis.flatMap((perfil): UserRole[] => {
    if (perfil === "ATENDENTE_SVO") return ["SVO"];
    return validRoles.has(perfil as UserRole) ? [perfil as UserRole] : [];
  });
  if (roles.length === 0) {
    throw new Error("Usuário sem perfil autorizado para o sistema.");
  }
  return roles;
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
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
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
  return { user: null, token: null, isAuthenticated: false, isLoading: false };
}

function mensagemErroLogin(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; mensagem?: string } | undefined;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.mensagem === "string" && data.mensagem.trim()) return data.mensagem;
    if (error.response?.status === 401) return "Credenciais inválidas";
    if (error.response?.status === 400) return "email e senha são obrigatórios";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocorreu um erro ao tentar acessar. Verifique suas credenciais.";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(readSession);

  const logout = useCallback(() => {
    clearSession();
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = async ({ usuario, senha }: LoginCredentials) => {
    if (!usuario?.trim() || !senha) {
      throw new Error("Informe o e-mail e a senha.");
    }

    try {
      const { data } = await api.post<LoginApiResponse>("/api/v1/auth/login", {
        email: usuario.trim(),
        senha,
      });

      const user: User = {
        id: data.usuario.id,
        nome: data.usuario.nome,
        email: data.usuario.email,
        roles: mapPerfis(data.usuario.perfis),
      };

      saveSession(user, data.token);
      setState({ user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      throw new Error(mensagemErroLogin(error));
    }
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
