import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-csrf", expiresIn: 28800 }),
}));
import {
  allowedOrigins,
  cookieOptions,
  issueCsrf,
  protectRequests,
  readCookie,
  sessionCookieName,
} from "../../../src/middleware/session_http";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ORIGINS", undefined);
});
function protection(session = "") {
  const cookie = vi.fn(),
    json = vi.fn();
  issueCsrf(
    { headers: { cookie: session } } as Request,
    { cookie, json, setHeader: vi.fn() } as unknown as Response,
  );
  return {
    cookie: `${cookie.mock.calls[0][0]}=${cookie.mock.calls[0][1]}`,
    nonce: json.mock.calls[0][0].csrfToken,
  };
}
function check(path: string, cookie?: string, nonce?: string, origin?: string) {
  const next = vi.fn();
  protectRequests(
    {
      method: "POST",
      path,
      headers: { cookie, "x-csrf-token": nonce, origin },
    } as unknown as Request,
    {} as Response,
    next,
  );
  return { next, error: next.mock.calls[0]?.[0] };
}
describe("proteção do navegador", () => {
  it("aceita assinatura válida e rejeita token adulterado", () => {
    const p = protection();
    expect(check("/auth/login", p.cookie, p.nonce).next).toHaveBeenCalledOnce();
    expect(check("/auth/login", p.cookie, "a".repeat(64)).error).toMatchObject({ statusCode: 403 });
  });
  it("vincula o CSRF ao cookie da sessão atual", () => {
    const p = protection("frota_session=sessao-a");
    expect(
      check("/api/v1/veiculos", `frota_session=sessao-a; ${p.cookie}`, p.nonce).next,
    ).toHaveBeenCalledOnce();
    expect(
      check("/api/v1/veiculos", `frota_session=sessao-b; ${p.cookie}`, p.nonce).error,
    ).toMatchObject({ statusCode: 403 });
  });
  it.each(["/auth/login", "/AUTH/LOGIN/", "/api/v1/auth/logout/"])(
    "protege aliases e barra final: %s",
    (path) => {
      expect(check(path).error).toMatchObject({ statusCode: 403 });
    },
  );
  it("bloqueia origem externa mesmo com CSRF válido", () => {
    const p = protection();
    expect(check("/auth/login", p.cookie, p.nonce, "https://externo.example").error).toMatchObject({
      statusCode: 403,
    });
  });
  it("configura cookies de produção com Secure e prefixo Host", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(sessionCookieName()).toBe("__Host-frota_session");
  });
  it("exige origens explícitas HTTPS em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(allowedOrigins).toThrow("obrigatória");
    vi.stubEnv("APP_ORIGINS", "http://example.test");
    expect(allowedOrigins).toThrow("HTTPS");
    vi.stubEnv("APP_ORIGINS", "https://example.test");
    expect(allowedOrigins()).toEqual(["https://example.test"]);
  });
  it("recusa cookies duplicados ou mal codificados", () => {
    expect(readCookie({ headers: { cookie: "a=1; a=2" } } as Request, "a")).toBeUndefined();
    expect(readCookie({ headers: { cookie: "a=%ZZ" } } as Request, "a")).toBeUndefined();
  });
});
