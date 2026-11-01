import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateUsuario: vi.fn(),
  deleteSessoes: vi.fn(),
  updateSessoes: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  registrarAuditoria: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: mocks.findUnique,
      update: mocks.updateUsuario,
    },
    authSessao: {
      deleteMany: mocks.deleteSessoes,
      updateMany: mocks.updateSessoes,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        usuario: { update: mocks.updateUsuario },
        authSessao: {
          deleteMany: mocks.deleteSessoes,
          updateMany: mocks.updateSessoes,
        },
      }),
    ),
  },
}));

vi.mock("../../../src/service/password_s", () => ({
  comparePassword: mocks.comparePassword,
  hashPassword: mocks.hashPassword,
}));

vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

import { passwordVersion } from "../../../src/service/session_s";
import {
  alterarMinhaSenha,
  redefinirSenhaPorAdmin,
  validarNovaSenha,
} from "../../../src/service/senha_s";

const usuarioId = randomUUID();
const sessaoId = randomUUID();
const outroUsuarioId = randomUUID();

describe("senha_s", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: usuarioId,
      email: "gestor@frota.com",
      ativo: true,
      senhaHash: "hash-antigo",
    });
    mocks.comparePassword.mockImplementation(
      async (senha: string, hash: string) => senha === "SenhaAtual@123" && hash === "hash-antigo",
    );
    mocks.hashPassword.mockResolvedValue("hash-novo-bcrypt");
    mocks.updateUsuario.mockResolvedValue({});
    mocks.deleteSessoes.mockResolvedValue({ count: 2 });
    mocks.updateSessoes.mockResolvedValue({ count: 1 });
    mocks.registrarAuditoria.mockResolvedValue({});
  });

  it("valida tamanho mínimo e limite de 72 bytes UTF-8 da nova senha", () => {
    expect(() => validarNovaSenha("")).toThrow("Informe uma nova senha válida");
    expect(() => validarNovaSenha("curta12")).toThrow("pelo menos 8 caracteres");
    expect(() => validarNovaSenha("😀".repeat(20))).toThrow("72 bytes");
    expect(validarNovaSenha("NovaSenha@2026")).toBe("NovaSenha@2026");
  });

  it("rejeita senha atual incorreta ou igual à nova sem gravar no banco", async () => {
    await expect(
      alterarMinhaSenha({
        usuarioId,
        sessaoId,
        senhaAtual: "Errada@123",
        novaSenha: "NovaSenha@2026",
      }),
    ).rejects.toThrow("senha atual informada está incorreta");
    expect(mocks.updateUsuario).not.toHaveBeenCalled();

    await expect(
      alterarMinhaSenha({
        usuarioId,
        sessaoId,
        senhaAtual: "SenhaAtual@123",
        novaSenha: "SenhaAtual@123",
      }),
    ).rejects.toThrow("diferente da senha atual");
    expect(mocks.updateUsuario).not.toHaveBeenCalled();
  });

  it("atualiza hash, preserva sessão atual, revoga demais sessões e registra auditoria sem expor senha", async () => {
    await alterarMinhaSenha({
      usuarioId,
      sessaoId,
      senhaAtual: "SenhaAtual@123",
      novaSenha: "NovaSenha@2026",
    });

    expect(mocks.hashPassword).toHaveBeenCalledWith("NovaSenha@2026");
    expect(mocks.updateUsuario).toHaveBeenCalledWith({
      where: { id: usuarioId },
      data: { senhaHash: "hash-novo-bcrypt" },
    });
    expect(mocks.deleteSessoes).toHaveBeenCalledWith({
      where: { usuarioId, id: { not: sessaoId } },
    });
    expect(mocks.updateSessoes).toHaveBeenCalledWith({
      where: { id: sessaoId, usuarioId },
      data: { senhaVersao: passwordVersion("hash-novo-bcrypt") },
    });
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith({
      usuarioId,
      acao: "ALTERAR_SENHA",
      tabelaAfetada: "usuarios",
      registroId: usuarioId,
      dadosNovos: { origem: "PROPRIO_USUARIO" },
    });
  });

  it("permite ao ADMIN redefinir senha de outro usuário revogando todas as sessões dele", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: outroUsuarioId,
      email: "motorista@frota.com",
    });

    await redefinirSenhaPorAdmin({
      adminId: usuarioId,
      sessaoAdminId: sessaoId,
      usuarioAlvoId: outroUsuarioId,
      novaSenha: "SenhaTemporaria@2026",
    });

    expect(mocks.updateUsuario).toHaveBeenCalledWith({
      where: { id: outroUsuarioId },
      data: { senhaHash: "hash-novo-bcrypt" },
    });
    expect(mocks.deleteSessoes).toHaveBeenCalledWith({
      where: { usuarioId: outroUsuarioId },
    });
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith({
      usuarioId,
      acao: "REDEFINIR_SENHA_ADMIN",
      tabelaAfetada: "usuarios",
      registroId: outroUsuarioId,
      dadosNovos: { emailAlvo: "motorista@frota.com" },
    });
  });
});
