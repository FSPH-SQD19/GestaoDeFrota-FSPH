import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthToken } from "../../../src/middleware/auth_m";
import { autorizarPerfis } from "../../../src/middleware/RBAC_m";
import {
  authenticate,
  HttpError,
  requireRole,
  usuarioAutenticado,
} from "../../../src/middleware/http_m";

const secret = "segredo-sintetico-middleware";

function autenticar(authorization?: string) {
  const req = { headers: { authorization } } as Request;
  const res = { locals: {} } as Response;
  const next = vi.fn();
  AuthToken(req, res, next);
  return { res, next };
}

beforeEach(() => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
});

describe("contrato único de autenticação", () => {
  it("mantém os nomes antigos como aliases da implementação comum", () => {
    expect(AuthToken).toBe(authenticate);
    expect(autorizarPerfis).toBe(requireRole);
  });

  it("expõe a identidade em locals.usuario para os consumidores comuns", () => {
    const token = jwt.sign({ perfis: ["GESTOR"] }, secret, { subject: "usuario-sintetico" });
    const { res, next } = autenticar(`Bearer ${token}`);
    expect(next).toHaveBeenCalledExactlyOnceWith();
    expect(usuarioAutenticado(res)).toEqual({ id: "usuario-sintetico", perfis: ["GESTOR"] });
    expect(res.locals.auth).toBeUndefined();
  });

  it.each([
    undefined,
    "Basic abc",
    "Bearer",
    "Bearer abc.def.ghi",
    `Bearer ${jwt.sign({ perfis: [] }, secret, { subject: "u" })} extra`,
    `Bearer ${jwt.sign({ perfis: ["ADMIN"] }, "outra-chave", { subject: "u" })}`,
    `Bearer ${jwt.sign({ perfis: [] }, secret, { subject: "u", expiresIn: -1 })}`,
    ...[
      "texto",
      {},
      { sub: 123, perfis: [] },
      { sub: "", perfis: [] },
      { sub: "   ", perfis: [] },
      { sub: "u" },
      { sub: "u", perfis: "ADMIN" },
      { sub: "u", perfis: [123] },
    ].map((payload) => `Bearer ${jwt.sign(payload, secret)}`),
  ])("encaminha HttpError 401 e não define identidade para %j", (header) => {
    const { res, next } = autenticar(header);
    expect(next).toHaveBeenCalledExactlyOnceWith(expect.any(HttpError));
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, errors: [] });
    expect(res.locals.usuario).toBeUndefined();
  });

  it("encaminha erro de configuração ao handler", () => {
    vi.mocked(getAuthConfig).mockImplementation(() => {
      throw new Error("Arquivo de chave indisponível");
    });
    const { next } = autenticar("Bearer token");
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 500 });
  });
});

describe("autorização por perfis", () => {
  it("exige autenticação inclusive ao ser usado sozinho", () => {
    const next = vi.fn();
    autorizarPerfis("ADMIN")({} as Request, { locals: {} } as Response, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
    expect(() => usuarioAutenticado({ locals: {} })).toThrow(HttpError);
  });

  it.each([{ perfis: [] }, { perfis: ["MOTORISTA"] }, { perfis: ["admin"] }])(
    "nega perfis $perfis",
    ({ perfis }) => {
      const next = vi.fn();
      autorizarPerfis("ADMIN")(
        {} as Request,
        { locals: { usuario: { id: "u", perfis } } } as unknown as Response,
        next,
      );
      expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, errors: [] });
    },
  );

  it("aceita qualquer perfil permitido entre múltiplos perfis", () => {
    const next = vi.fn();
    autorizarPerfis("ADMIN", "GESTOR")(
      {} as Request,
      {
        locals: { usuario: { id: "u", perfis: ["MOTORISTA", "GESTOR"] } },
      } as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });
});
