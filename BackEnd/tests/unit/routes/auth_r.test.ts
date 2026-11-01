import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  updateUser: vi.fn(),
  create: vi.fn(),
  session: vi.fn(),
  touch: vi.fn(),
  remove: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  limit: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: mocks.user, update: mocks.updateUser },
    authSessao: {
      create: mocks.create,
      findUnique: mocks.session,
      updateMany: mocks.touch,
      deleteMany: mocks.remove,
    },
    auditoriaSistema: { create: mocks.audit },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        usuario: { update: mocks.updateUser },
        authSessao: {
          updateMany: mocks.touch,
          deleteMany: mocks.remove,
        },
      }),
    ),
    $queryRaw: mocks.limit,
  },
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-auth", expiresIn: 28800 }),
}));
vi.mock("../../../src/service/password_s", () => ({
  comparePassword: mocks.compare,
  hashPassword: mocks.hash,
}));
import { app } from "../../../src/app";
import { passwordVersion } from "../../../src/service/session_s";
const secret = "segredo-sintetico-auth";
const usuario = {
  id: randomUUID(),
  nome: "Teste",
  email: "teste@example.test",
  ativo: true,
  senhaHash: "hash",
  perfis: [{ perfil: { nome: "ADMIN" } }],
};
let server: Server, base: string;
let stored: {
  id: string;
  usuarioId: string;
  senhaVersao: string;
  expiraEm: Date;
} | null;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  stored = null;
  mocks.user.mockResolvedValue(usuario);
  mocks.updateUser.mockResolvedValue(usuario);
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue("novo-hash-bcrypt");
  mocks.audit.mockResolvedValue({});
  mocks.create.mockImplementation(async ({ data }) => {
    stored = data;
    return data;
  });
  mocks.session.mockImplementation(async () => stored && { ...stored, usuario });
  mocks.touch.mockResolvedValue({ count: 1 });
  mocks.remove.mockImplementation(async () => {
    stored = null;
    return { count: 1 };
  });
  mocks.limit.mockResolvedValue([{ tentativas: 1, expira_em: new Date(Date.now() + 900000) }]);
});
function cookie(response: Response, name: string) {
  return response.headers
    .getSetCookie()
    .find((x) => x.startsWith(name + "="))!
    .split(";")[0];
}
async function csrf(prefix: string, session = "") {
  const response = await fetch(`${base}${prefix}/csrf`, { headers: { cookie: session } });
  return {
    nonce: (await response.json()).csrfToken as string,
    cookie: cookie(response, "frota_csrf"),
  };
}
async function login(prefix: string) {
  const protection = await csrf(prefix);
  const response = await fetch(`${base}${prefix}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: protection.cookie,
      "x-csrf-token": protection.nonce,
    },
    body: JSON.stringify({ email: usuario.email, senha: "senha-sintetica" }),
  });
  const session = cookie(response, "frota_session");
  return { response, protection: await csrf(prefix, session), cookie: session };
}
describe.each(["/auth", "/api/v1/auth"])("sessões HTTP %s", (prefix) => {
  it("login retorna usuário, cookie HttpOnly e cabeçalhos HTTP de segurança", async () => {
    const { response, cookie: session } = await login(prefix);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(await response.json()).toEqual({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: ["ADMIN"] },
    });
    expect(response.headers.getSetCookie().join()).toContain("HttpOnly");
    expect(response.headers.getSetCookie().join()).toContain("SameSite=Lax");
    const token = decodeURIComponent(session.split("=")[1]);
    expect(
      jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: "fsph-frota-api",
        audience: "fsph-frota-web",
      }),
    ).toMatchObject({ sub: usuario.id, jti: stored!.id });
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      200,
    );
  });
  it("logout revoga a sessão e rejeita replay do mesmo cookie", async () => {
    const { cookie: session, protection } = await login(prefix);
    const response = await fetch(`${base}${prefix}/logout`, {
      method: "POST",
      headers: { cookie: `${session}; ${protection.cookie}`, "x-csrf-token": protection.nonce },
    });
    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalled();
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      401,
    );
  });
  it("rejeita usuário inativo e mudança de senha", async () => {
    const { cookie: session } = await login(prefix);
    mocks.session.mockImplementation(async () => ({
      ...stored,
      usuario: { ...usuario, ativo: false },
    }));
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      401,
    );
    mocks.session.mockImplementation(async () => ({
      ...stored,
      usuario: { ...usuario, senhaHash: "outro-hash" },
    }));
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      401,
    );
  });
  it("revalida permissões atuais para rotas administrativas", async () => {
    const { cookie: session } = await login(prefix);
    mocks.session.mockImplementation(async () => ({
      ...stored,
      usuario: { ...usuario, perfis: [{ perfil: { nome: "MOTORISTA" } }] },
    }));
    expect((await fetch(`${base}${prefix}/admin`, { headers: { cookie: session } })).status).toBe(
      403,
    );
  });
  it("mantém a expiração absoluta sem registrar atividade no banco", async () => {
    const { cookie: session } = await login(prefix);
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      200,
    );
    expect(mocks.touch).not.toHaveBeenCalled();
    stored!.expiraEm = new Date(Date.now() - 1);
    expect((await fetch(`${base}${prefix}/sessao`, { headers: { cookie: session } })).status).toBe(
      401,
    );
  });
  it("recusa login sem CSRF e de origem não autorizada", async () => {
    const response = await fetch(`${base}${prefix}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(
      (await fetch(`${base}${prefix}/csrf`, { headers: { origin: "https://atacante.example" } }))
        .status,
    ).toBe(403);
  });
  it("limita tentativas por IP e conta antes de comparar senha", async () => {
    const protection = await csrf(prefix);
    mocks.limit.mockResolvedValue([{ tentativas: 31, expira_em: new Date() }]);
    const response = await fetch(`${base}${prefix}/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: protection.cookie,
        "x-csrf-token": protection.nonce,
      },
      body: JSON.stringify({ email: usuario.email, senha: "senha" }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(mocks.compare).not.toHaveBeenCalled();
  });
  it("não permite alterações autenticadas por cookie sem proteção CSRF", async () => {
    const { cookie: session } = await login(prefix);
    expect(
      (
        await fetch(`${base}/api/v1/fornecedores`, {
          method: "POST",
          headers: { cookie: session, "content-type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  });
  it("usa fingerprint de senha sem persistir outra cópia do hash bcrypt", async () => {
    await login(prefix);
    expect(stored!.senhaVersao).toBe(passwordVersion(usuario.senhaHash));
    expect(stored!.senhaVersao).not.toBe(usuario.senhaHash);
  });
  it("permite alterar a própria senha autenticado com CSRF e restringe redefinição ao ADMIN", async () => {
    const { cookie: session, protection } = await login(prefix);
    mocks.compare
      .mockResolvedValueOnce(true) // senhaAtual confere
      .mockResolvedValueOnce(false); // novaSenha é diferente da atual

    const alteracao = await fetch(`${base}${prefix}/alterar-senha`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: `${session}; ${protection.cookie}`,
        "x-csrf-token": protection.nonce,
      },
      body: JSON.stringify({
        senhaAtual: "senha-sintetica",
        novaSenha: "NovaSenhaForte@2026",
      }),
    });
    expect(alteracao.status).toBe(200);
    expect(await alteracao.json()).toEqual({ mensagem: "Senha alterada com sucesso." });

    // Restaura sessão em memória para testar redefinição por ADMIN vs não-ADMIN
    const sessionJti = (jwt.decode(decodeURIComponent(session.split("=")[1])) as jwt.JwtPayload)
      .jti!;
    stored = {
      id: sessionJti,
      usuarioId: usuario.id,
      senhaVersao: passwordVersion(usuario.senhaHash),
      expiraEm: new Date(Date.now() + 900000),
    };
    const alvoId = randomUUID();
    const redefinicaoAdmin = await fetch(`${base}${prefix}/usuarios/${alvoId}/redefinir-senha`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: `${session}; ${protection.cookie}`,
        "x-csrf-token": protection.nonce,
      },
      body: JSON.stringify({ novaSenha: "SenhaRedefinida@2026" }),
    });
    expect(redefinicaoAdmin.status).toBe(200);

    // Usuário sem perfil ADMIN recebe 403
    stored = {
      id: sessionJti,
      usuarioId: usuario.id,
      senhaVersao: passwordVersion(usuario.senhaHash),
      expiraEm: new Date(Date.now() + 900000),
    };
    mocks.session.mockImplementationOnce(async () => ({
      ...stored,
      usuario: { ...usuario, perfis: [{ perfil: { nome: "GESTOR" } }] },
    }));
    const redefinicaoNegada = await fetch(`${base}${prefix}/usuarios/${alvoId}/redefinir-senha`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: `${session}; ${protection.cookie}`,
        "x-csrf-token": protection.nonce,
      },
      body: JSON.stringify({ novaSenha: "SenhaRedefinida@2026" }),
    });
    expect(redefinicaoNegada.status).toBe(403);
  });
});
