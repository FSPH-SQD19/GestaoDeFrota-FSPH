import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { securityHeaders } from "../../../src/middleware/security_headers";

describe("securityHeaders middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aplica cabeçalhos de proteção HTTP equivalentes ao Helmet sem HSTS em desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = new Map<string, string>();
    const res = {
      setHeader: vi.fn((nome: string, valor: string) => {
        headers.set(nome, valor);
      }),
    } as unknown as Response;
    const next = vi.fn();

    securityHeaders({} as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
    expect(headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("inclui Strict-Transport-Security em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = new Map<string, string>();
    const res = {
      setHeader: vi.fn((nome: string, valor: string) => {
        headers.set(nome, valor);
      }),
    } as unknown as Response;
    const next = vi.fn();

    securityHeaders({} as Request, res, next);

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });
});
