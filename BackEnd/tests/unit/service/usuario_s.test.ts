import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { HttpError } from "../../../src/lib/http_error";

const mocks = vi.hoisted(() => {
  const tx = {
    usuario: { create: vi.fn(), update: vi.fn() },
    motorista: { updateMany: vi.fn() },
    usuarioPerfil: { deleteMany: vi.fn(), createMany: vi.fn() },
    authSessao: { deleteMany: vi.fn() },
  };
  return {
    tx,
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    perfilFindMany: vi.fn(),
    hashPassword: vi.fn(),
    invalidarCacheSincronizacaoNotificacoes: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    usuario: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      update: mocks.update,
    },
    perfil: { findMany: mocks.perfilFindMany },
  },
}));
vi.mock("../../../src/service/password_s", () => ({
  hashPassword: mocks.hashPassword,
}));
vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../../src/service/notificacao_sync_cache", () => ({
  invalidarCacheSincronizacaoNotificacoes: mocks.invalidarCacheSincronizacaoNotificacoes,
}));

import { registrarAuditoria } from "../../../src/service/auditoria_s";
import {
  atualizarUsuario,
  criarUsuario,
  criarUsuarioSchema,
  inativarUsuario,
  listarUsuarios,
  obterUsuario,
} from "../../../src/service/usuario_s";

const adminId = "00000000-0000-4000-8000-0000000000a1";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const perfilAdminId = "00000000-0000-4000-8000-0000000000b1";
const perfilGestorId = "00000000-0000-4000-8000-0000000000b2";

const registro = {
  id: usuarioId,
  nome: "Ana Souza",
  email: "ana@example.test",
  telefone: "(79) 99999-1234",
  setor: "LACEN",
  ativo: true,
  criadoEm: new Date("2026-11-04T12:00:00Z"),
  perfis: [{ perfil: { nome: "GESTOR" } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("hash-seguro");
  mocks.perfilFindMany.mockResolvedValue([{ id: perfilGestorId, nome: "GESTOR" }]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockResolvedValue(registro);
  mocks.tx.usuario.create.mockResolvedValue(registro);
  mocks.tx.usuario.update.mockResolvedValue({ ...registro, ativo: false });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
});

describe("listarUsuarios", () => {
  it("retorna página com meta e serializa perfis", async () => {
    mocks.findMany.mockResolvedValue([registro]);
    mocks.count.mockResolvedValue(1);

    await expect(
      listarUsuarios({ page: 1, pageSize: 20, busca: "Ana", ativo: undefined }),
    ).resolves.toEqual({
      data: [
        {
          id: usuarioId,
          nome: "Ana Souza",
          email: "ana@example.test",
          telefone: "(79) 99999-1234",
          setor: "LACEN",
          ativo: true,
          criadoEm: registro.criadoEm,
          perfis: ["GESTOR"],
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("aplica filtros de setor, perfil e ativo", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    await listarUsuarios({
      page: 1,
      pageSize: 20,
      setor: "LACEN",
      perfil: "SVO",
      ativo: false,
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ativo: false,
          setor: { equals: "LACEN", mode: "insensitive" },
          perfis: { some: { perfil: { nome: "SVO" } } },
        },
      }),
    );
  });
});

describe("obterUsuario", () => {
  it("rejeita id inválido e ausência", async () => {
    await expect(obterUsuario("abc")).rejects.toMatchObject({
      statusCode: 400,
    } satisfies Partial<HttpError>);
    mocks.findUnique.mockResolvedValue(null);
    await expect(obterUsuario(usuarioId)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("criarUsuario", () => {
  it("não permite criar conta com perfil MOTORISTA pela gestão genérica", async () => {
    await expect(
      criarUsuario({ ...entrada, perfis: ["MOTORISTA"] }, adminId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "O perfil MOTORISTA deve ser atribuído pelo cadastro da Gestão de Motoristas.",
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  const entrada = {
    nome: "Ana Souza",
    email: "ana@example.test",
    senha: "senha-segura",
    telefone: "79999991234",
    setor: "LACEN",
    perfis: ["GESTOR" as const],
  };

  it("cadastra usuário com senha hasheada e perfis", async () => {
    const criado = await criarUsuario(entrada, adminId);

    expect(criado).toEqual({
      id: usuarioId,
      nome: "Ana Souza",
      email: "ana@example.test",
      telefone: "(79) 99999-1234",
      setor: "LACEN",
      ativo: true,
      criadoEm: registro.criadoEm,
      perfis: ["GESTOR"],
    });
    expect(mocks.hashPassword).toHaveBeenCalledWith("senha-segura");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "ana@example.test",
          senhaHash: "hash-seguro",
          telefone: "(79) 99999-1234",
          setor: "LACEN",
          perfis: { create: [{ perfilId: perfilGestorId }] },
        }),
      }),
    );
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: adminId,
        acao: "CRIAR",
        tabelaAfetada: "usuarios",
        registroId: usuarioId,
      }),
    );
  });

  it("rejeita senha curta e e-mail duplicado", async () => {
    await expect(criarUsuario({ ...entrada, senha: "1234567" }, adminId)).rejects.toMatchObject({
      statusCode: 400,
    });
    mocks.findUnique.mockResolvedValue({ id: usuarioId });
    await expect(criarUsuario(entrada, adminId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("traduz conflito de e-mail na gravação", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicado", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );
    await expect(criarUsuario(entrada, adminId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejeita perfil inexistente", async () => {
    mocks.perfilFindMany.mockResolvedValue([]);
    await expect(criarUsuario(entrada, adminId)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejeita telefone inválido e senha acima de 72 bytes", async () => {
    await expect(criarUsuario({ ...entrada, telefone: "99" }, adminId)).rejects.toMatchObject({
      statusCode: 400,
      message: "Telefone deve conter DDD e 8 ou 9 dígitos.",
    });
    await expect(
      criarUsuario({ ...entrada, senha: "a".repeat(73) }, adminId),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("aceita cadastro sem telefone e setor", async () => {
    mocks.create.mockResolvedValue({ ...registro, telefone: null, setor: null });
    const criado = await criarUsuario(
      { nome: "Ana Souza", email: "ana@example.test", senha: "senha-segura", perfis: ["GESTOR"] },
      adminId,
    );
    expect(criado.telefone).toBeNull();
    expect(criado.setor).toBeNull();
  });

  it.each(["abc", "---"])("rejeita telefone preenchido sem dígitos: %s", async (telefone) => {
    await expect(criarUsuario({ ...entrada, telefone }, adminId)).rejects.toMatchObject({
      statusCode: 400,
      errors: [{ campo: "telefone", mensagem: "Telefone deve conter DDD e 8 ou 9 dígitos." }],
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("normaliza e-mail com espaços e maiúsculas antes de validar", () => {
    expect(
      criarUsuarioSchema.parse({
        nome: "Ana Souza",
        email: "  ANA@Example.TEST ",
        senha: "senha-segura",
        perfis: ["GESTOR"],
      }).email,
    ).toBe("ana@example.test");
  });
});

describe("atualizarUsuario", () => {
  it.each([
    { atuais: ["GESTOR"], solicitados: ["GESTOR", "MOTORISTA"] },
    { atuais: ["GESTOR", "MOTORISTA"], solicitados: ["GESTOR"] },
  ] as const)(
    "não permite alterar o perfil MOTORISTA pela gestão genérica",
    async ({ atuais, solicitados }) => {
      mocks.findUnique.mockResolvedValue({
        ...registro,
        perfis: atuais.map((nome) => ({ perfil: { nome } })),
      });
      await expect(
        atualizarUsuario(usuarioId, { perfis: [...solicitados] }, adminId),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "O perfil MOTORISTA só pode ser atribuído ou removido pela Gestão de Motoristas.",
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it("preserva o perfil MOTORISTA quando a conta mantém esse perfil", async () => {
    mocks.findUnique.mockResolvedValue({
      ...registro,
      perfis: [{ perfil: { nome: "MOTORISTA" } }],
    });
    mocks.perfilFindMany.mockResolvedValue([{ id: "perfil-motorista", nome: "MOTORISTA" }]);

    await atualizarUsuario(usuarioId, { perfis: ["MOTORISTA"] }, adminId);

    expect(mocks.tx.usuarioPerfil.createMany).toHaveBeenCalledWith({
      data: [{ usuarioId, perfilId: "perfil-motorista" }],
    });
  });

  it("rejeita telefone inválido sem apagar o contato existente", async () => {
    mocks.findUnique.mockResolvedValue(registro);
    await expect(atualizarUsuario(usuarioId, { telefone: "abc" }, adminId)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])(
    "permite limpar explicitamente o telefone com %s",
    async (telefone) => {
      mocks.findUnique.mockResolvedValue(registro);
      await atualizarUsuario(usuarioId, { telefone }, adminId);
      expect(mocks.tx.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { telefone: null } }),
      );
      expect(mocks.tx.motorista.updateMany).toHaveBeenCalledWith({
        where: { usuarioId },
        data: { telefone: null },
      });
      expect(mocks.tx.authSessao.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("mantém o telefone do motorista sincronizado ao atualizar o telefone da conta", async () => {
    mocks.findUnique.mockResolvedValue(registro);

    await atualizarUsuario(usuarioId, { telefone: "79988887777" }, adminId);

    expect(mocks.tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { telefone: "(79) 98888-7777" } }),
    );
    expect(mocks.tx.motorista.updateMany).toHaveBeenCalledWith({
      where: { usuarioId },
      data: { telefone: "(79) 98888-7777" },
    });
  });

  it("sincroniza o estado ativo da conta com o cadastro do motorista", async () => {
    mocks.findUnique.mockResolvedValue(registro);

    await atualizarUsuario(usuarioId, { ativo: false }, adminId);

    expect(mocks.tx.motorista.updateMany).toHaveBeenCalledWith({
      where: { usuarioId },
      data: { ativo: false },
    });
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
    expect(mocks.invalidarCacheSincronizacaoNotificacoes).toHaveBeenCalledOnce();
  });

  it("invalida o cache de notificações quando o nome de um usuário muda", async () => {
    mocks.findUnique.mockResolvedValue(registro);

    await atualizarUsuario(usuarioId, { nome: "Ana Atualizada" }, adminId);

    expect(mocks.invalidarCacheSincronizacaoNotificacoes).toHaveBeenCalledOnce();
  });

  it("não altera o telefone do motorista quando o telefone da conta não foi enviado", async () => {
    mocks.findUnique.mockResolvedValue(registro);

    await atualizarUsuario(usuarioId, { nome: "Ana Atualizada" }, adminId);

    expect(mocks.tx.motorista.updateMany).not.toHaveBeenCalled();
  });

  it("revoga sessões ao repetir a inativação via PATCH, como no DELETE", async () => {
    mocks.findUnique.mockResolvedValue({ ...registro, ativo: false });
    await atualizarUsuario(usuarioId, { ativo: false }, adminId);
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
  });

  it("impede autoinativação e remoção do próprio ADMIN", async () => {
    mocks.findUnique.mockResolvedValue({
      id: adminId,
      ativo: true,
      perfis: [{ perfil: { nome: "ADMIN" } }],
    });

    await expect(atualizarUsuario(adminId, { ativo: false }, adminId)).rejects.toMatchObject({
      statusCode: 400,
    });

    await expect(atualizarUsuario(adminId, { perfis: ["GESTOR"] }, adminId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("atualiza perfis e campos públicos", async () => {
    mocks.findUnique.mockResolvedValue({
      id: usuarioId,
      ativo: true,
      perfis: [{ perfil: { nome: "GESTOR" } }],
    });
    mocks.perfilFindMany.mockResolvedValue([
      { id: perfilAdminId, nome: "ADMIN" },
      { id: perfilGestorId, nome: "GESTOR" },
    ]);
    mocks.tx.usuario.update.mockResolvedValue({
      ...registro,
      nome: "Ana Atualizada",
      perfis: [{ perfil: { nome: "ADMIN" } }, { perfil: { nome: "GESTOR" } }],
    });

    const atualizado = await atualizarUsuario(
      usuarioId,
      { nome: "Ana Atualizada", perfis: ["ADMIN", "GESTOR"] },
      adminId,
    );

    expect(atualizado.nome).toBe("Ana Atualizada");
    expect(atualizado.perfis).toEqual(["ADMIN", "GESTOR"]);
    expect(mocks.tx.usuarioPerfil.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
    expect(mocks.tx.usuarioPerfil.createMany).toHaveBeenCalled();
  });

  it("inativa via PATCH e revoga sessões", async () => {
    mocks.findUnique.mockResolvedValue({
      id: usuarioId,
      ativo: true,
      perfis: [{ perfil: { nome: "GESTOR" } }],
    });
    mocks.tx.usuario.update.mockResolvedValue({ ...registro, ativo: false });

    const atualizado = await atualizarUsuario(usuarioId, { ativo: false }, adminId);

    expect(atualizado.ativo).toBe(false);
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
    expect(mocks.invalidarCacheSincronizacaoNotificacoes).toHaveBeenCalledOnce();
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        dadosNovos: expect.objectContaining({ operacao: "INATIVAR" }),
      }),
    );
  });

  it("rejeita e-mail duplicado na atualização", async () => {
    mocks.findUnique.mockResolvedValue({
      id: usuarioId,
      ativo: true,
      perfis: [{ perfil: { nome: "GESTOR" } }],
    });
    mocks.findFirst.mockResolvedValue({ id: adminId });
    await expect(
      atualizarUsuario(usuarioId, { email: "outro@example.test" }, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("inativarUsuario", () => {
  it("inativa, revoga sessões e audita", async () => {
    mocks.findUnique.mockResolvedValue({ id: usuarioId, ativo: true });

    const inativado = await inativarUsuario(usuarioId, adminId);

    expect(inativado.ativo).toBe(false);
    expect(mocks.tx.motorista.updateMany).toHaveBeenCalledWith({
      where: { usuarioId },
      data: { ativo: false },
    });
    expect(mocks.tx.authSessao.deleteMany).toHaveBeenCalledWith({ where: { usuarioId } });
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: "ATUALIZAR",
        dadosNovos: expect.objectContaining({ operacao: "INATIVAR" }),
      }),
    );
  });

  it("impede inativar a própria conta", async () => {
    await expect(inativarUsuario(adminId, adminId)).rejects.toMatchObject({ statusCode: 400 });
  });
});
