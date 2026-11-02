import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthConfig } from "../../../src/config/auth";
import { resolveSession } from "../../../src/service/session_s";
import {
  authenticate,
  HttpError,
  requireRole,
  usuarioAutenticado,
} from "../../../src/middleware/http_m";
import { AuthToken } from "../../../src/middleware/auth_m";
import { autorizarPerfis } from "../../../src/middleware/RBAC_m";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
vi.mock("../../../src/service/session_s", () => ({ resolveSession: vi.fn() }));
const secret = "segredo-sintetico-middleware";
const sid = "00000000-0000-4000-8000-000000000001";
function token(overrides: jwt.SignOptions = {}, payload: object = {}) {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    subject: "u",
    jwtid: sid,
    issuer: "fsph-frota-api",
    audience: "fsph-frota-web",
    expiresIn: 28800,
    ...overrides,
  });
}
async function autenticar(authorization?: string, cookie?: string) {
  const req = { headers: { authorization, cookie } } as Request;
  const res = { locals: {} } as Response;
  const next = vi.fn();
  await AuthToken(req, res, next);
  return { res, next };
}
beforeEach(() => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  vi.mocked(resolveSession).mockResolvedValue({
    id: "u",
    nome: "Teste",
    email: "teste@example.test",
    perfis: ["GESTOR"],
    sessaoId: sid,
  });
});
describe("autenticação estrita", () => {
  it("mantém os aliases", () => {
    expect(AuthToken).toBe(authenticate);
    expect(autorizarPerfis).toBe(requireRole);
  });
  it("usa permissões atuais do banco e não as do token", async () => {
    const { res, next } = await autenticar(`Bearer ${token({}, { perfis: ["ADMIN"] })}`);
    expect(next).toHaveBeenCalledExactlyOnceWith();
    expect(usuarioAutenticado(res).perfis).toEqual(["GESTOR"]);
    expect(resolveSession).toHaveBeenCalledWith("u", sid);
  });
  it("aceita cookie de sessão", async () => {
    expect(
      (await autenticar(undefined, `frota_session=${token()}`)).next,
    ).toHaveBeenCalledExactlyOnceWith();
  });
  it.each([
    undefined,
    "Basic abc",
    "Bearer",
    "Bearer abc.def.ghi",
    ...[
      { algorithm: "HS512" },
      { issuer: "outra" },
      { audience: "outra" },
      { expiresIn: -1 },
      { subject: " " },
      { jwtid: "invalido" },
      { expiresIn: 28801 },
    ].map((options) => `Bearer ${token(options as jwt.SignOptions)}`),
    `Bearer ${jwt.sign({ sub: "u", jti: sid, iss: "fsph-frota-api", aud: "fsph-frota-web" }, secret)}`,
    `Bearer ${jwt.sign({}, "outra-chave", { subject: "u" })}`,
  ])("rejeita credencial inválida %j antes de consultar o banco", async (header) => {
    const { next, res } = await autenticar(header);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
    expect(res.locals.usuario).toBeUndefined();
    expect(resolveSession).not.toHaveBeenCalled();
  });
  it("rejeita sessão revogada ou usuário bloqueado", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);
    expect((await autenticar(`Bearer ${token()}`)).next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
    });
  });
  it("falha sem autorizar quando o banco está indisponível", async () => {
    const error = new Error("Banco indisponível");
    vi.mocked(resolveSession).mockRejectedValue(error);
    expect((await autenticar(`Bearer ${token()}`)).next).toHaveBeenCalledWith(error);
  });
  it("encaminha falha da chave", async () => {
    vi.mocked(getAuthConfig).mockImplementation(() => {
      throw new Error("Chave indisponível");
    });
    expect((await autenticar(`Bearer ${token()}`)).next.mock.calls[0][0]).toMatchObject({
      statusCode: 500,
    });
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
