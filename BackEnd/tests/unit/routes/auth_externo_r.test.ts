import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  upsertPerfil: vi.fn(),
  createSession: vi.fn(),
  findUniqueSession: vi.fn(),
  deleteManySession: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  queryRawLimit: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: mocks.findUniqueUser,
      create: mocks.createUser,
      update: mocks.updateUser,
    },
    perfil: {
      upsert: mocks.upsertPerfil,
    },
    authSessao: {
      create: mocks.createSession,
      findUnique: mocks.findUniqueSession,
      deleteMany: mocks.deleteManySession,
    },
    auditoriaSistema: {
      create: mocks.createAudit,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        usuario: {
          create: mocks.createUser,
          update: mocks.updateUser,
        },
        perfil: {
          upsert: mocks.upsertPerfil,
        },
        auditoriaSistema: {
          create: mocks.createAudit,
        },
      }),
    ),
    $queryRaw: mocks.queryRawLimit,
  },
}));

vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-auth-externo", expiresIn: 28800 }),
}));

vi.mock("../../../src/service/password_s", () => ({
  comparePassword: mocks.comparePassword,
  hashPassword: mocks.hashPassword,
}));

import { app } from "../../../src/app";

const usuarioExterno = {
  id: randomUUID(),
  nome: "SAMU 192 Sergipe",
  email: "regulacao@samu.se.gov.br",
  telefone: "(79) 99111-2233",
  setor: "SAMU 192",
  ativo: true,
  senhaHash: "hash-externo-seguro",
  criadoEm: new Date("2026-11-17T10:00:00.000Z"),
  perfis: [{ perfil: { nome: "EXTERNO" } }],
};

let server: Server;
let base: string;
let sessaoAtiva: {
  id: string;
  usuarioId: string;
  senhaVersao: string;
  expiraEm: Date;
} | null = null;

function extrairCookie(response: Response, nome: string) {
  return response.headers
    .getSetCookie()
    .find((item) => item.startsWith(`${nome}=`))!
    .split(";")[0];
}

async function obterCsrf(sessionCookie = "") {
  const response = await fetch(`${base}/api/v1/auth/csrf`, {
    headers: sessionCookie ? { cookie: sessionCookie } : {},
  });
  const body = (await response.json()) as { csrfToken: string };
  return {
    nonce: body.csrfToken,
    cookie: extrairCookie(response, "frota_csrf"),
  };
}

describe("S19FROTA-280 — Rotas de cadastro, login e isolamento RBAC do perfil EXTERNO", () => {
  beforeAll(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAtiva = null;
    mocks.findUniqueUser.mockResolvedValue(null);
    mocks.upsertPerfil.mockResolvedValue({
      id: randomUUID(),
      nome: "EXTERNO",
    });
    mocks.hashPassword.mockResolvedValue(usuarioExterno.senhaHash);
    mocks.comparePassword.mockResolvedValue(true);
    mocks.createUser.mockResolvedValue(usuarioExterno);
    mocks.createAudit.mockResolvedValue({});
    mocks.createSession.mockImplementation(async ({ data }) => {
      sessaoAtiva = data;
      return data;
    });
    mocks.findUniqueSession.mockImplementation(
      async () => sessaoAtiva && { ...sessaoAtiva, usuario: usuarioExterno },
    );
    mocks.queryRawLimit.mockResolvedValue([
      { tentativas: 1, expira_em: new Date(Date.now() + 900_000) },
    ]);
  });

  it("cadastra usuário EXTERNO em POST /api/v1/auth/cadastro-externo com CSRF, cria sessão HttpOnly e permite consultar /externo/me", async () => {
    const csrf = await obterCsrf();

    const cadastroRes = await fetch(`${base}/api/v1/auth/cadastro-externo`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: csrf.cookie,
        "x-csrf-token": csrf.nonce,
      },
      body: JSON.stringify({
        nome: usuarioExterno.nome,
        email: usuarioExterno.email,
        senha: "SenhaExterna@2026",
        telefone: "79991112233",
        instituicao: "SAMU 192",
      }),
    });

    expect(cadastroRes.status).toBe(201);
    const body = await cadastroRes.json();
    expect(body).toEqual({
      usuario: {
        id: usuarioExterno.id,
        nome: usuarioExterno.nome,
        email: usuarioExterno.email,
        telefone: "(79) 99111-2233",
        instituicao: "SAMU 192",
        perfis: ["EXTERNO"],
      },
    });

    const sessionCookie = extrairCookie(cadastroRes, "frota_session");
    expect(sessionCookie).toContain("frota_session=");

    // Consulta própria autenticada em /api/v1/auth/externo/me
    mocks.findUniqueUser.mockResolvedValueOnce(usuarioExterno);
    const meRes = await fetch(`${base}/api/v1/auth/externo/me`, {
      headers: { cookie: sessionCookie },
    });
    expect(meRes.status).toBe(200);
    expect(await meRes.json()).toEqual({
      usuario: {
        id: usuarioExterno.id,
        nome: usuarioExterno.nome,
        email: usuarioExterno.email,
        telefone: usuarioExterno.telefone,
        instituicao: usuarioExterno.setor,
        criadoEm: usuarioExterno.criadoEm.toISOString(),
        perfis: ["EXTERNO"],
      },
    });
  });

  it("aplica rate limiting (429) no cadastro externo quando o limite de tentativas é excedido", async () => {
    const csrf = await obterCsrf();
    mocks.queryRawLimit.mockResolvedValueOnce([
      { tentativas: 11, expira_em: new Date(Date.now() + 900_000) },
    ]);

    const res = await fetch(`${base}/api/v1/auth/cadastro-externo`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: csrf.cookie,
        "x-csrf-token": csrf.nonce,
      },
      body: JSON.stringify({
        nome: "Teste",
        email: "teste@externo.test",
        senha: "SenhaExterna@2026",
        telefone: "79991112233",
      }),
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("retorna 401 em /api/v1/auth/externo/me sem sessão e 403 quando acessado por perfil interno", async () => {
    const semSessao = await fetch(`${base}/api/v1/auth/externo/me`);
    expect(semSessao.status).toBe(401);

    // Login como GESTOR interno
    const csrf = await obterCsrf();
    mocks.findUniqueUser.mockResolvedValueOnce({
      ...usuarioExterno,
      perfis: [{ perfil: { nome: "GESTOR" } }],
    });
    const loginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: csrf.cookie,
        "x-csrf-token": csrf.nonce,
      },
      body: JSON.stringify({ email: usuarioExterno.email, senha: "SenhaExterna@2026" }),
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extrairCookie(loginRes, "frota_session");

    mocks.findUniqueSession.mockResolvedValueOnce({
      ...sessaoAtiva!,
      usuario: {
        ...usuarioExterno,
        perfis: [{ perfil: { nome: "GESTOR" } }],
      },
    });

    const proibidoParaGestor = await fetch(`${base}/api/v1/auth/externo/me`, {
      headers: { cookie: sessionCookie },
    });
    expect(proibidoParaGestor.status).toBe(403);
  });

  it.each([
    "/api/v1/veiculos",
    "/api/v1/motoristas",
    "/api/v1/fornecedores",
    "/api/v1/usuarios",
    "/api/v1/solicitacoes",
    "/api/v1/dashboard/resumo",
    "/api/v1/relatorios",
    "/api/v1/manutencoes",
    "/api/v1/abastecimentos",
    "/api/v1/multas",
    "/api/v1/avarias",
    "/api/v1/sedes",
    "/api/v1/auditoria",
    "/api/v1/agenda",
    "/api/v1/svo/chamados",
    "/api/v1/svo/viaturas",
    "/api/v1/svo/motoristas",
    "/api/v1/svo/indicadores",
    "/api/v1/svo/escalas",
  ])("bloqueia com 403 o acesso do usuário EXTERNO à rota interna %s", async (rotaInterna) => {
    const csrf = await obterCsrf();
    mocks.findUniqueUser.mockResolvedValueOnce(usuarioExterno);

    const loginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: csrf.cookie,
        "x-csrf-token": csrf.nonce,
      },
      body: JSON.stringify({ email: usuarioExterno.email, senha: "SenhaExterna@2026" }),
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extrairCookie(loginRes, "frota_session");

    const resposta = await fetch(`${base}${rotaInterna}`, {
      headers: { cookie: sessionCookie },
    });
    expect(resposta.status).toBe(403);
  });
});
