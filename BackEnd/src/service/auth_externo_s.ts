import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthConfig } from "../config/auth";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import { validar } from "../lib/validar";
import type { UsuarioAutenticado } from "../middleware/http_m";
import { sanitizarLgpd } from "./auditoria_s";
import { hashPassword } from "./password_s";
import { validarNovaSenha } from "./senha_s";
import { createSession } from "./session_s";
import { normalizarTelefone } from "./telefone_s";
import { signToken } from "./token_s";

export const PERFIL_EXTERNO = "EXTERNO";
export const DESCRICAO_PERFIL_EXTERNO = "Solicitante externo do portal SVO";
export const SETOR_PADRAO_EXTERNO = "PORTAL_EXTERNO_SVO";

export const cadastroUsuarioExternoSchema = z
  .object({
    nome: z
      .string({ error: "Informe o nome completo ou responsável." })
      .trim()
      .min(2, "Informe o nome completo com ao menos 2 caracteres.")
      .max(150, "Use no máximo 150 caracteres no nome."),
    email: z
      .string({ error: "Informe um e-mail válido." })
      .trim()
      .toLowerCase()
      .pipe(
        z
          .email({ error: "Informe um e-mail válido." })
          .max(150, "Use no máximo 150 caracteres no e-mail."),
      ),
    senha: z.string({ error: "Informe uma senha de acesso." }),
    telefone: z
      .string({ error: "Informe um telefone de contato com DDD." })
      .trim()
      .min(8, "Telefone deve conter DDD e 8 ou 9 dígitos.")
      .max(20, "Use no máximo 20 caracteres no telefone."),
    instituicao: z
      .string()
      .trim()
      .min(2, "O nome da instituição deve ter ao menos 2 caracteres.")
      .max(100, "Use no máximo 100 caracteres na instituição.")
      .optional(),
  })
  .strict();

export type CadastroUsuarioExternoInput = z.infer<typeof cadastroUsuarioExternoSchema>;

export function ehUsuarioExclusivamenteExterno(
  usuario: Pick<UsuarioAutenticado, "perfis"> | null | undefined,
): boolean {
  if (!usuario || !Array.isArray(usuario.perfis)) return false;
  return usuario.perfis.length === 1 && usuario.perfis[0] === PERFIL_EXTERNO;
}

export function garantirIsolamentoExterno(
  usuario: UsuarioAutenticado | null | undefined,
  proprietarioId: string,
): void {
  if (!usuario?.id) {
    throw new HttpError(401, "Entre no sistema para continuar.");
  }

  if (usuario.perfis.includes(PERFIL_EXTERNO)) {
    if (!ehUsuarioExclusivamenteExterno(usuario)) {
      throw new HttpError(
        403,
        "O perfil EXTERNO é isolado e não pode ser combinado com perfis internos.",
      );
    }
    if (usuario.id !== proprietarioId) {
      throw new HttpError(
        403,
        "Você não tem permissão para consultar ou alterar dados de outro solicitante.",
      );
    }
  }
}

export async function cadastrarUsuarioExterno(rawInput: unknown) {
  const parsed = validar(cadastroUsuarioExternoSchema, rawInput);
  const senhaValidada = validarNovaSenha(parsed.senha, "senha");
  const telefoneNormalizado = normalizarTelefone(parsed.telefone);

  if (!telefoneNormalizado) {
    throw new HttpError(400, "Telefone deve conter DDD e 8 ou 9 dígitos.", [
      { campo: "telefone", mensagem: "Telefone deve conter DDD e 8 ou 9 dígitos." },
    ]);
  }

  const existente = await prisma.usuario.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });

  if (existente) {
    throw new HttpError(
      409,
      "Já existe uma conta cadastrada com este e-mail. Faça login ou recupere seu acesso.",
      [{ campo: "email", mensagem: "Já existe uma conta cadastrada com este e-mail." }],
    );
  }

  const senhaHash = await hashPassword(senhaValidada);
  const setor = parsed.instituicao?.trim() ? parsed.instituicao.trim() : SETOR_PADRAO_EXTERNO;

  let criado: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    setor: string | null;
    criadoEm: Date;
  };

  try {
    criado = await prisma.$transaction(async (tx) => {
      const perfilExterno = await tx.perfil.upsert({
        where: { nome: PERFIL_EXTERNO },
        update: { descricao: DESCRICAO_PERFIL_EXTERNO },
        create: { nome: PERFIL_EXTERNO, descricao: DESCRICAO_PERFIL_EXTERNO },
      });

      const novoUsuario = await tx.usuario.create({
        data: {
          nome: parsed.nome,
          email: parsed.email,
          senhaHash,
          telefone: telefoneNormalizado,
          setor,
          ativo: true,
          perfis: {
            create: [{ perfilId: perfilExterno.id }],
          },
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          setor: true,
          criadoEm: true,
        },
      });

      await tx.auditoriaSistema.create({
        data: {
          usuarioId: novoUsuario.id,
          acao: "CADASTRO_EXTERNO",
          tabelaAfetada: "usuarios",
          registroId: novoUsuario.id,
          dadosNovos: sanitizarLgpd({
            id: novoUsuario.id,
            nome: novoUsuario.nome,
            email: novoUsuario.email,
            telefone: novoUsuario.telefone,
            setor: novoUsuario.setor,
            perfis: [PERFIL_EXTERNO],
          }) as Prisma.InputJsonValue,
        },
      });

      return novoUsuario;
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new HttpError(
        409,
        "Já existe uma conta cadastrada com este e-mail. Faça login ou recupere seu acesso.",
        [{ campo: "email", mensagem: "Já existe uma conta cadastrada com este e-mail." }],
      );
    }
    throw erro;
  }

  const { expiresIn } = getAuthConfig();
  const sessaoId = await createSession(criado.id, senhaHash, expiresIn);
  const token = signToken(criado.id, sessaoId);

  return {
    token,
    usuario: {
      id: criado.id,
      nome: criado.nome,
      email: criado.email,
      telefone: criado.telefone,
      instituicao: criado.setor,
      perfis: [PERFIL_EXTERNO],
    },
  };
}

export async function obterMeuPerfilExterno(usuarioAutenticado: UsuarioAutenticado) {
  if (!usuarioAutenticado?.id) {
    throw new HttpError(401, "Entre no sistema para continuar.");
  }

  if (!ehUsuarioExclusivamenteExterno(usuarioAutenticado)) {
    throw new HttpError(403, "Acesso exclusivo para solicitantes do portal externo SVO.");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioAutenticado.id },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      setor: true,
      ativo: true,
      criadoEm: true,
      perfis: {
        select: {
          perfil: { select: { nome: true } },
        },
      },
    },
  });

  if (!usuario || !usuario.ativo) {
    throw new HttpError(401, "Sua sessão expirou. Entre novamente.");
  }

  const perfis = usuario.perfis.map((p) => p.perfil.nome);
  if (perfis.length !== 1 || perfis[0] !== PERFIL_EXTERNO) {
    throw new HttpError(403, "Acesso exclusivo para solicitantes do portal externo SVO.");
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    instituicao: usuario.setor,
    criadoEm: usuario.criadoEm,
    perfis: [PERFIL_EXTERNO],
  };
}
