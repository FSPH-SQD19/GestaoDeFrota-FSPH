import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, resetCsrf, setUnauthorizedHandler } from "../../../src/services/api";
const requests: InternalAxiosRequestConfig[] = [];
beforeEach(() => {
  requests.length = 0;
  resetCsrf();
  setUnauthorizedHandler(null);
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return {
      data: config.url?.endsWith("/csrf") ? { csrfToken: "a".repeat(64) } : {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
});
describe("transporte de autenticação", () => {
  it("envia cookie e CSRF sem reaproveitar token legado do localStorage", async () => {
    localStorage.setItem("@fsph_frota_token", "token-antigo");
    await api.post("/api/v1/auth/login", { email: "teste@example.test", senha: "senha" });
    expect(requests.map((r) => r.url)).toEqual(["/api/v1/auth/csrf", "/api/v1/auth/login"]);
    expect(requests[1].withCredentials).toBe(true);
    expect(requests[1].headers["X-CSRF-Token"]).toBe("a".repeat(64));
    expect(requests[1].headers.Authorization).toBeUndefined();
  });
  it("compartilha a obtenção de CSRF entre alterações concorrentes", async () => {
    await Promise.all([api.post("/a"), api.patch("/b")]);
    expect(requests.filter((r) => r.url?.endsWith("/csrf"))).toHaveLength(1);
  });
  it("limpa sessão e avisa o contexto em resposta 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    localStorage.setItem("@fsph_frota_token", "antigo");
    api.defaults.adapter = async (config) => {
      throw new AxiosError("401", "ERR_BAD_REQUEST", config, undefined, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        data: {},
        config,
      });
    };
    await expect(api.get("/api/v1/auth/sessao")).rejects.toThrow();
    expect(handler).toHaveBeenCalledOnce();
    expect(localStorage.getItem("@fsph_frota_token")).toBeNull();
  });
});
