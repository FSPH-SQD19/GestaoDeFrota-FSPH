import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createUser: vi.fn(),
  upsertPerfil: vi.fn(),
  createAudit: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: mocks.findUnique,
      create: mocks.createUser,
    },
    perfil: {
      upsert: mocks.upsertPerfil,
    },
    auditoriaSistema: {
      create: mocks.createAudit,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        usuario: { create: mocks.createUser },
        perfil: { upsert: mocks.upsertPerfil },
        auditoriaSistema: { create: mocks.createAudit },
      }),
    ),
  },
}));

vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-teste-externo-32-caracteres", expiresIn: 28800 }),
}));

vi.mock("../../../src/service/password_s", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("../../../src/service/session_s", () => ({
  createSession: mocks.createSession,
}));

import {
  cadastrarUsuarioExterno,
  ehUsuarioExclusivamenteExterno,
  garantirIsolamentoExterno,
  obterMeuPerfilExterno,
} from "../../../src/service/auth_externo_s";

const usuarioCriado = {
  id: "00000000-0000-4000-8000-000000000501",
  nome: "UPA Zona Norte",
  email: "upa.norte@saude.se.gov.br",
  telefone: "(79) 99888-7766",
  setor: "UPA Zona Norte",
  ativo: true,
  criadoEm: new Date("2026-11-17T10:00:00.000Z"),
  perfis: [{ perfil: { nome: "EXTERNO" } }],
};

describe("S19FROTA-280 — Serviço de cadastro e isolamento de usuário EXTERNO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsertPerfil.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000599",
      nome: "EXTERNO",
    });
    mocks.hashPassword.mockResolvedValue("$2b$10$hashSinteticoSeguro");
    mocks.createUser.mockResolvedValue(usuarioCriado);
    mocks.createAudit.mockResolvedValue({});
    mocks.createSession.mockResolvedValue("00000000-0000-4000-8000-000000000555");
  });

  it("cadastra usuário com perfil exclusivamente EXTERNO, hash de senha, sessão e auditoria", async () => {
    const resultado = await cadastrarUsuarioExterno({
      nome: "UPA Zona Norte",
      email: "  UPA.NORTE@saude.se.gov.br ",
      senha: "SenhaForte@2026",
      telefone: "79998887766",
      instituicao: "UPA Zona Norte",
    });

    expect(mocks.hashPassword).toHaveBeenCalledWith("SenhaForte@2026");
    expect(mocks.upsertPerfil).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nome: "EXTERNO" } }),
    );
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: "UPA Zona Norte",
          email: "upa.norte@saude.se.gov.br",
          telefone: "(79) 99888-7766",
          setor: "UPA Zona Norte",
          ativo: true,
        }),
      }),
    );
    expect(mocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acao: "CADASTRO_EXTERNO",
          tabelaAfetada: "usuarios",
          registroId: usuarioCriado.id,
        }),
      }),
    );
    expect(resultado.usuario).toEqual({
      id: usuarioCriado.id,
      nome: "UPA Zona Norte",
      email: "upa.norte@saude.se.gov.br",
      telefone: "(79) 99888-7766",
      instituicao: "UPA Zona Norte",
      perfis: ["EXTERNO"],
    });
    expect(typeof resultado.token).toBe("string");
  });

  it("rejeita tentativa de injeção de perfis ou campos extras no cadastro público (.strict)", async () => {
    await expect(
      cadastrarUsuarioExterno({
        nome: "Atacante",
        email: "atacante@externo.test",
        senha: "SenhaForte@2026",
        telefone: "79998887766",
        perfis: ["ADMIN"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejeita cadastro com e-mail já utilizado retornando 409", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: usuarioCriado.id });

    await expect(
      cadastrarUsuarioExterno({
        nome: "Duplicado",
        email: "upa.norte@saude.se.gov.br",
        senha: "SenhaForte@2026",
        telefone: "79998887766",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("garante isolamento horizontal entre usuários EXTERNO e bloqueia combinação de perfis", () => {
    const externoA = {
      id: "00000000-0000-4000-8000-000000000501",
      perfis: ["EXTERNO"],
    };

    expect(ehUsuarioExclusivamenteExterno(externoA)).toBe(true);
    expect(() => garantirIsolamentoExterno(externoA, externoA.id)).not.toThrow();

    expect(() =>
      garantirIsolamentoExterno(externoA, "00000000-0000-4000-8000-000000000502"),
    ).toThrow("Você não tem permissão para consultar ou alterar dados de outro solicitante.");

    expect(() =>
      garantirIsolamentoExterno({ id: externoA.id, perfis: ["EXTERNO", "ADMIN"] }, externoA.id),
    ).toThrow("O perfil EXTERNO é isolado e não pode ser combinado com perfis internos.");

    expect(() => garantirIsolamentoExterno(null, externoA.id)).toThrow(
      "Entre no sistema para continuar.",
    );
  });

  it("retorna apenas os dados próprios em obterMeuPerfilExterno e recusa perfis internos", async () => {
    mocks.findUnique.mockResolvedValueOnce(usuarioCriado);

    const meuPerfil = await obterMeuPerfilExterno({
      id: usuarioCriado.id,
      perfis: ["EXTERNO"],
    });

    expect(meuPerfil).toEqual({
      id: usuarioCriado.id,
      nome: usuarioCriado.nome,
      email: usuarioCriado.email,
      telefone: usuarioCriado.telefone,
      instituicao: usuarioCriado.setor,
      criadoEm: usuarioCriado.criadoEm,
      perfis: ["EXTERNO"],
    });

    await expect(
      obterMeuPerfilExterno({
        id: usuarioCriado.id,
        perfis: ["GESTOR"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
