import axios, { type InternalAxiosRequestConfig } from "axios";

const DEFAULT_API_URL = "http://localhost:3000";
function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  return typeof fromEnv === "string" && fromEnv.trim()
    ? fromEnv.replace(/\/$/, "")
    : DEFAULT_API_URL;
}
export const api = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
let onUnauthorized: (() => void) | null = null;
let csrfRequest: Promise<string> | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}
export function clearAuthSession(): void {
  // Remove credenciais persistidas por versões antigas do front-end.
  try {
    localStorage.removeItem("@fsph_frota_token");
    localStorage.removeItem("@fsph_frota_user");
  } catch {
    /* Armazenamento indisponível. */
  }
}
export function resetCsrf(): void {
  csrfRequest = null;
}
async function csrfToken(): Promise<string> {
  csrfRequest ??= api
    .get<{ csrfToken: string }>("/api/v1/auth/csrf")
    .then(({ data }) => data.csrfToken)
    .catch((error) => {
      csrfRequest = null;
      throw error;
    });
  return csrfRequest;
}
api.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes(config.method?.toLowerCase() || "get"))
    config.headers["X-CSRF-Token"] = await csrfToken();
  return config;
});
function isLoginRequest(config?: InternalAxiosRequestConfig): boolean {
  return (config?.url || "").includes("/auth/login");
}
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
    if (axios.isAxiosError(error) && error.response?.status === 403) resetCsrf();
    return Promise.reject(error);
  },
);
