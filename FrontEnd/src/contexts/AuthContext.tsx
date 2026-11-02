import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { User, UserRole, LoginCredentials, AuthState } from "../types/auth";
import { api, clearAuthSession, resetCsrf, setUnauthorizedHandler } from "../services/api";
import {
  browserSessionExpired,
  markBrowserLogout,
  readBrowserSession,
  startBrowserSession,
  watchBrowserSession,
} from "../services/browserSession";
import { AuthContext } from "./auth";

const validRoles = new Set<UserRole>(["ADMIN", "GESTOR", "MOTORISTA", "SVO", "SOLICITANTE"]);
interface SessionResponse {
  usuario: { id: string; nome: string; email: string; perfis: string[] };
}
const emptyState: AuthState = {
  user: null,
  sessionKey: null,
  isAuthenticated: false,
  isLoading: false,
};
function sessionState({ usuario }: SessionResponse): AuthState {
  const user: User = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    roles: mapPerfis(usuario.perfis),
  };
  return { user, sessionKey: crypto.randomUUID(), isAuthenticated: true, isLoading: false };
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
  const [state, setState] = useState<AuthState>(() =>
    browserSessionExpired() ? emptyState : { ...emptyState, isLoading: true },
  );
  const generation = useRef(0);
  const endSession = useCallback(() => {
    generation.current++;
    clearAuthSession();
    resetCsrf();
    setState(emptyState);
  }, []);
  const revoking = useRef<Promise<boolean> | null>(null);
  const retryLogout = useCallback(() => {
    revoking.current ??= api
      .post("/api/v1/auth/logout")
      .then(() => {
        markBrowserLogout(false);
        return true;
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          markBrowserLogout(false);
          return true;
        }
        return false;
      })
      .finally(() => {
        revoking.current = null;
      });
    return revoking.current;
  }, []);
  const expireSession = useCallback(() => {
    markBrowserLogout(true);
    endSession(); // Oculta os dados imediatamente, inclusive sem conexão.
    void retryLogout();
  }, [endSession, retryLogout]);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    clearAuthSession();
    setUnauthorizedHandler(() => {
      markBrowserLogout(false);
      endSession();
    });
    const stored = readBrowserSession();
    if (stored?.status === "pending" || (stored?.status === "active" && browserSessionExpired())) {
      markBrowserLogout(true);
      void retryLogout().then(() => {
        if (active && generation.current === current) endSession();
      });
    } else if (stored?.status !== "ended") {
      void api
        .get<SessionResponse>("/api/v1/auth/sessao")
        .then(({ data }) => {
          if (!active || generation.current !== current) return;
          if (browserSessionExpired()) {
            expireSession();
            return;
          }
          if (!readBrowserSession()) startBrowserSession();
          setState(sessionState(data));
        })
        .catch(() => {
          if (active && generation.current === current) setState(emptyState);
        });
    }
    const retry = () => {
      if (readBrowserSession()?.status === "pending") void retryLogout();
    };
    const interval = window.setInterval(retry, 30_000);
    window.addEventListener("online", retry);
    return () => {
      active = false;
      setUnauthorizedHandler(null);
      window.clearInterval(interval);
      window.removeEventListener("online", retry);
    };
  }, [endSession, expireSession, retryLogout]);
  useEffect(() => {
    if (state.isAuthenticated) return watchBrowserSession(expireSession, endSession);
  }, [state.isAuthenticated, expireSession, endSession]);

  const logout = useCallback(async () => {
    // Só confirme a saída depois que a API revogar a sessão.
    try {
      await api.post("/api/v1/auth/logout");
      markBrowserLogout(false);
      endSession();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        markBrowserLogout(false);
        endSession();
      } else window.alert("Não foi possível encerrar a sessão. Tente novamente.");
    }
  }, [endSession]);
  const login = async ({ usuario, senha }: LoginCredentials) => {
    if (!usuario?.trim() || !senha) throw new Error("Informe o e-mail e a senha.");
    if (readBrowserSession()?.status === "pending" && !(await retryLogout())) {
      throw new Error(
        "Não foi possível encerrar a sessão anterior. Verifique a conexão e tente novamente.",
      );
    }
    const current = ++generation.current;
    try {
      const { data } = await api.post<SessionResponse>("/api/v1/auth/login", {
        email: usuario.trim(),
        senha,
      });
      resetCsrf();
      if (generation.current === current) {
        startBrowserSession();
        setState(sessionState(data));
      }
    } catch (error) {
      throw new Error(mensagemErroLogin(error));
    }
  };
  const hasRole = (requiredRoles: UserRole[]) =>
    !!state.user &&
    (requiredRoles.length === 0 || state.user.roles.some((role) => requiredRoles.includes(role)));
  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
