import { respostaDeErro } from "../lib/api";
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
  usuarioSaidaOffline,
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
const OFFLINE_IDENTITY_KEY = "@fsph_frota_offline_identity";
function offlineIdentity(): AuthState | null {
  if (navigator.onLine || browserSessionExpired()) return null;
  try {
    const cached = JSON.parse(
      sessionStorage.getItem(OFFLINE_IDENTITY_KEY) || "null",
    ) as User | null;
    if (
      !cached ||
      cached.id !== usuarioSaidaOffline() ||
      !Array.isArray(cached.roles) ||
      !cached.roles.includes("MOTORISTA")
    )
      return null;
    return {
      user: cached,
      sessionKey: crypto.randomUUID(),
      isAuthenticated: true,
      isLoading: false,
    };
  } catch {
    return null;
  }
}
function sessionState({ usuario }: SessionResponse): AuthState {
  const user: User = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    roles: mapPerfis(usuario.perfis),
  };
  try {
    sessionStorage.setItem(OFFLINE_IDENTITY_KEY, JSON.stringify(user));
  } catch {
    /* unavailable */
  }
  return { user, sessionKey: crypto.randomUUID(), isAuthenticated: true, isLoading: false };
}
function mapPerfis(perfis: string[]): UserRole[] {
  const roles = perfis.flatMap((perfil): UserRole[] => {
    if (perfil === "ATENDENTE_SVO") return ["SVO"];
    return validRoles.has(perfil as UserRole) ? [perfil as UserRole] : [];
  });
  if (roles.length === 0) {
    throw new Error("Seu usuário não tem acesso ao sistema. Entre em contato com o administrador.");
  }
  return roles;
}

function mensagemErroLogin(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      { message?: string; error?: string; mensagem?: string } | undefined;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.mensagem === "string" && data.mensagem.trim()) return data.mensagem;
    if (error.response?.status === 401)
      return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
    if (error.response?.status === 400) return "Informe o e-mail e a senha.";
  }
  return respostaDeErro(error, "Não foi possível entrar no sistema. Tente novamente.");
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(
    () =>
      offlineIdentity() ??
      (browserSessionExpired() ? emptyState : { ...emptyState, isLoading: true }),
  );
  const generation = useRef(0);
  const endSession = useCallback(() => {
    generation.current++;
    clearAuthSession();
    resetCsrf();
    try {
      const cached = JSON.parse(
        sessionStorage.getItem(OFFLINE_IDENTITY_KEY) || "null",
      ) as User | null;
      if (cached?.id)
        void import("../features/motorista/offline")
          .then((m) => m.limparOfflineSincronizado(cached.id))
          .catch(() => {});
      sessionStorage.removeItem(OFFLINE_IDENTITY_KEY);
    } catch {
      /* unavailable */
    }
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
    const offline = offlineIdentity();
    if (offline) {
      /* Initial state already restored from the current tab identity. */
    } else if (
      stored?.status === "pending" ||
      (stored?.status === "active" && browserSessionExpired())
    ) {
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
