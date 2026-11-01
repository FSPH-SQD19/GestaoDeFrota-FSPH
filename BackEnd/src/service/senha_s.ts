import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";
import { registrarAuditoria } from "./auditoria_s";
import * as passwordService from "./password_s";
import { passwordVersion } from "./session_s";

const TAMANHO_MINIMO_SENHA = 8;
const BYTES_MAXIMOS_BCRYPT = 72;

export function validarNovaSenha(novaSenha: unknown, campo = "novaSenha"): string {
  if (typeof novaSenha !== "string" || !novaSenha.trim()) {
    throw new HttpError(400, "Informe uma nova senha válida.", [
      { campo, mensagem: "Informe uma nova senha válida." },
    ]);
  }
  if (Array.from(novaSenha).length < TAMANHO_MINIMO_SENHA) {
    throw new HttpError(
      400,
      `A nova senha deve possuir pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
      [
        {
          campo,
          mensagem: `A nova senha deve possuir pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
        },
      ],
    );
  }
  if (Buffer.byteLength(novaSenha, "utf8") > BYTES_MAXIMOS_BCRYPT) {
    throw new HttpError(400, "A nova senha deve ter no máximo 72 bytes.", [
      { campo, mensagem: "A nova senha deve ter no máximo 72 bytes." },
    ]);
  }
  return novaSenha;
}

export interface AlterarMinhaSenhaInput {
  usuarioId: string;
  sessaoId?: string;
  senhaAtual: unknown;
  novaSenha: unknown;
}

export async function alterarMinhaSenha({
  usuarioId,
  sessaoId,
  senhaAtual,
  novaSenha,
}: AlterarMinhaSenhaInput): Promise<void> {
  if (typeof senhaAtual !== "string" || !senhaAtual) {
    throw new HttpError(400, "Informe a senha atual.", [
      { campo: "senhaAtual", mensagem: "Informe a senha atual." },
    ]);
  }

  const novaSenhaValidada = validarNovaSenha(novaSenha, "novaSenha");

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, ativo: true, senhaHash: true },
  });

  if (!usuario || !usuario.ativo) {
    throw new HttpError(401, "Autenticação necessária.");
  }

  const senhaAtualCorreta = await passwordService.comparePassword(senhaAtual, usuario.senhaHash);
  if (!senhaAtualCorreta) {
    throw new HttpError(400, "A senha atual informada está incorreta.", [
      { campo: "senhaAtual", mensagem: "A senha atual informada está incorreta." },
    ]);
  }

  const mesmaSenha = await passwordService.comparePassword(novaSenhaValidada, usuario.senhaHash);
  if (mesmaSenha) {
    throw new HttpError(400, "A nova senha deve ser diferente da senha atual.", [
      { campo: "novaSenha", mensagem: "A nova senha deve ser diferente da senha atual." },
    ]);
  }

  const novoHash = await passwordService.hashPassword(novaSenhaValidada);
  const novaVersao = passwordVersion(novoHash);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash: novoHash },
    });

    if (sessaoId) {
      await tx.authSessao.deleteMany({
        where: { usuarioId: usuario.id, id: { not: sessaoId } },
      });
      await tx.authSessao.updateMany({
        where: { id: sessaoId, usuarioId: usuario.id },
        data: { senhaVersao: novaVersao },
      });
    } else {
      await tx.authSessao.deleteMany({
        where: { usuarioId: usuario.id },
      });
    }
  });

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ALTERAR_SENHA",
      tabelaAfetada: "usuarios",
      registroId: usuario.id,
      dadosNovos: { origem: "PROPRIO_USUARIO" },
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria de alteração de senha.", erro);
  }
}

export interface RedefinirSenhaAdminInput {
  adminId: string;
  sessaoAdminId?: string;
  usuarioAlvoId: string;
  novaSenha: unknown;
}

export async function redefinirSenhaPorAdmin({
  adminId,
  sessaoAdminId,
  usuarioAlvoId,
  novaSenha,
}: RedefinirSenhaAdminInput): Promise<void> {
  if (!z.uuid().safeParse(usuarioAlvoId).success) {
    throw new HttpError(400, "Identificador de usuário inválido.", [
      { campo: "id", mensagem: "Identificador de usuário inválido." },
    ]);
  }

  const novaSenhaValidada = validarNovaSenha(novaSenha, "novaSenha");

  const usuarioAlvo = await prisma.usuario.findUnique({
    where: { id: usuarioAlvoId },
    select: { id: true, email: true },
  });

  if (!usuarioAlvo) {
    throw new HttpError(404, "Usuário não encontrado.");
  }

  const novoHash = await passwordService.hashPassword(novaSenhaValidada);
  const novaVersao = passwordVersion(novoHash);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioAlvo.id },
      data: { senhaHash: novoHash },
    });

    if (adminId === usuarioAlvo.id && sessaoAdminId) {
      await tx.authSessao.deleteMany({
        where: { usuarioId: usuarioAlvo.id, id: { not: sessaoAdminId } },
      });
      await tx.authSessao.updateMany({
        where: { id: sessaoAdminId, usuarioId: usuarioAlvo.id },
        data: { senhaVersao: novaVersao },
      });
    } else {
      await tx.authSessao.deleteMany({
        where: { usuarioId: usuarioAlvo.id },
      });
    }
  });

  try {
    await registrarAuditoria({
      usuarioId: adminId,
      acao: "REDEFINIR_SENHA_ADMIN",
      tabelaAfetada: "usuarios",
      registroId: usuarioAlvo.id,
      dadosNovos: { emailAlvo: usuarioAlvo.email },
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria de redefinição administrativa de senha.", erro);
  }
}
