import axios, { type InternalAxiosRequestConfig } from "axios";

// Chaves iguais às do AuthContext (localStorage).
export const AUTH_TOKEN_KEY = "@fsph_frota_token";
export const AUTH_USER_KEY = "@fsph_frota_user";

const DEFAULT_API_URL = "http://localhost:3000";

function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return DEFAULT_API_URL;
}

export const api = axios.create({
  baseURL: apiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // Sem localStorage: o handler ainda limpa o estado em memória.
  }
}

function isLoginRequest(config?: InternalAxiosRequestConfig): boolean {
  const url = config?.url ?? "";
  return url.includes("/auth/login");
}

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Sem localStorage: segue sem Authorization.
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !isLoginRequest(error.config)
    ) {
      clearAuthSession();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
