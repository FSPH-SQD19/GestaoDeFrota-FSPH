import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import { registrarAuditoria } from "./auditoria_s";
import { hashPassword } from "./password_s";
import { validarNovaSenha } from "./senha_s";
import { normalizarTelefone } from "./telefone_s";

export const PERFIS_USUARIO = ["ADMIN", "GESTOR", "MOTORISTA", "SVO", "SOLICITANTE"] as const;

const usuarioSelect = {
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
} satisfies Prisma.UsuarioSelect;

type UsuarioComPerfis = Prisma.UsuarioGetPayload<{ select: typeof usuarioSelect }>;

export type UsuarioResposta = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  setor: string | null;
  ativo: boolean;
  criadoEm: Date;
  perfis: string[];
};

function serializarUsuario(usuario: UsuarioComPerfis): UsuarioResposta {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    setor: usuario.setor,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm,
    perfis: usuario.perfis.map((vinculo) => vinculo.perfil.nome),
  };
}

async function registrarAuditoriaUsuario(
  usuarioResponsavelId: string,
  acao: "CRIAR" | "ATUALIZAR",
  usuario: UsuarioResposta,
  operacao?: "INATIVAR",
): Promise<void> {
  try {
    await registrarAuditoria({
      usuarioId: usuarioResponsavelId,
      acao,
      tabelaAfetada: "usuarios",
      registroId: usuario.id,
      dadosNovos: JSON.parse(JSON.stringify(operacao ? { operacao, usuario } : usuario)),
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria do usuário", usuario.id, erro);
  }
}

async function resolverPerfilIds(nomes: string[]): Promise<string[]> {
  const unicos = [...new Set(nomes)];
  const perfis = await prisma.perfil.findMany({
    where: { nome: { in: unicos } },
    select: { id: true, nome: true },
  });
  if (perfis.length !== unicos.length) {
    const encontrados = new Set(perfis.map((perfil) => perfil.nome));
    const ausentes = unicos.filter((nome) => !encontrados.has(nome));
    throw new HttpError(422, "Um ou mais perfis informados não existem no sistema.", [
      {
        campo: "perfis",
        mensagem: `Perfis inexistentes: ${ausentes.join(", ")}.`,
      },
    ]);
  }
  return perfis.map((perfil) => perfil.id);
}

export const listarUsuariosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().trim().max(100).optional(),
  setor: z.string().trim().max(100).optional(),
  perfil: z.enum(PERFIS_USUARIO).optional(),
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === "true")),
});

export type ListarUsuariosFiltros = z.infer<typeof listarUsuariosSchema>;

export const criarUsuarioSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do usuário." })
    .trim()
    .min(2, "Informe o nome completo do usuário.")
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
  senha: z.string({ error: "Informe a senha inicial do usuário." }),
  telefone: z.string().trim().max(20).nullable().optional(),
  setor: z.string().trim().max(100, "Use no máximo 100 caracteres no setor.").nullable().optional(),
  perfis: z
    .array(z.enum(PERFIS_USUARIO), { error: "Informe ao menos um perfil válido." })
    .min(1, "Informe ao menos um perfil para o usuário."),
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "Informe o nome completo do usuário.")
      .max(150, "Use no máximo 150 caracteres no nome.")
      .optional(),
    email: z
      .string({ error: "Informe um e-mail válido." })
      .trim()
      .toLowerCase()
      .pipe(
        z
          .email({ error: "Informe um e-mail válido." })
          .max(150, "Use no máximo 150 caracteres no e-mail."),
      )
      .optional(),
    telefone: z.string().trim().max(20).nullable().optional(),
    setor: z
      .string()
      .trim()
      .max(100, "Use no máximo 100 caracteres no setor.")
      .nullable()
      .optional(),
    ativo: z.boolean().optional(),
    perfis: z
      .array(z.enum(PERFIS_USUARIO))
      .min(1, "Informe ao menos um perfil para o usuário.")
      .optional(),
  })
  .refine(
    (dados) =>
      dados.nome !== undefined ||
      dados.email !== undefined ||
      dados.telefone !== undefined ||
      dados.setor !== undefined ||
      dados.ativo !== undefined ||
      dados.perfis !== undefined,
    { message: "Informe ao menos um campo para atualizar." },
  );

export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

export async function listarUsuarios(filtros: ListarUsuariosFiltros) {
  const { page, pageSize, busca, setor, perfil, ativo } = filtros;

  const where: Prisma.UsuarioWhereInput = {
    ...(ativo === undefined ? {} : { ativo }),
    ...(setor ? { setor: { equals: setor, mode: "insensitive" } } : {}),
    ...(perfil ? { perfis: { some: { perfil: { nome: perfil } } } } : {}),
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { email: { contains: busca, mode: "insensitive" } },
            { setor: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [registros, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.usuario.count({ where }),
  ]);

  return {
    data: registros.map(serializarUsuario),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function obterUsuario(id: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "Não foi possível identificar o usuário. Selecione-o novamente.");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: usuarioSelect,
  });

  if (!usuario) {
    throw new HttpError(404, "Usuário não encontrado. Atualize a lista e tente novamente.");
  }

  return serializarUsuario(usuario);
}

export async function criarUsuario(input: CriarUsuarioInput, usuarioResponsavelId: string) {
  if (input.perfis.includes("MOTORISTA")) {
    throw new HttpError(
      400,
      "O perfil MOTORISTA deve ser atribuído pelo cadastro da Gestão de Motoristas.",
    );
  }

  const senha = validarNovaSenha(input.senha, "senha");
  const telefone = normalizarTelefone(input.telefone);
  const setor =
    input.setor === undefined
      ? null
      : input.setor === null || !input.setor.trim()
        ? null
        : input.setor.trim();

  const existente = await prisma.usuario.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existente) {
    throw new HttpError(
      409,
      "Já existe um usuário com este e-mail. Confira o cadastro existente.",
      [{ campo: "email", mensagem: "Já existe um usuário com este e-mail." }],
    );
  }

  const perfilIds = await resolverPerfilIds(input.perfis);
  const senhaHash = await hashPassword(senha);

  let criado: UsuarioComPerfis;
  try {
    criado = await prisma.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senhaHash,
        telefone: telefone ?? null,
        setor,
        ativo: true,
        perfis: {
          create: perfilIds.map((perfilId) => ({ perfilId })),
        },
      },
      select: usuarioSelect,
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new HttpError(
        409,
        "Já existe um usuário com este e-mail. Confira o cadastro existente.",
        [{ campo: "email", mensagem: "Já existe um usuário com este e-mail." }],
      );
    }
    throw erro;
  }

  const resposta = serializarUsuario(criado);
  await registrarAuditoriaUsuario(usuarioResponsavelId, "CRIAR", resposta);
  return resposta;
}

export async function atualizarUsuario(
  id: string,
  input: AtualizarUsuarioInput,
  usuarioResponsavelId: string,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "Não foi possível identificar o usuário. Selecione-o novamente.");
  }

  const atual = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      ativo: true,
      perfis: { select: { perfil: { select: { nome: true } } } },
    },
  });

  if (!atual) {
    throw new HttpError(404, "Usuário não encontrado. Atualize a lista e tente novamente.");
  }

  if (input.perfis) {
    const motoristaAtual = atual.perfis.some((vinculo) => vinculo.perfil.nome === "MOTORISTA");
    const motoristaSolicitado = input.perfis.includes("MOTORISTA");
    if (motoristaAtual !== motoristaSolicitado) {
      throw new HttpError(
        400,
        "O perfil MOTORISTA só pode ser atribuído ou removido pela Gestão de Motoristas.",
      );
    }
  }

  if (id === usuarioResponsavelId && input.ativo === false) {
    throw new HttpError(400, "Você não pode inativar a própria conta.");
  }

  if (id === usuarioResponsavelId && input.perfis) {
    const mantemAdmin = input.perfis.includes("ADMIN");
    const eraAdmin = atual.perfis.some((vinculo) => vinculo.perfil.nome === "ADMIN");
    if (eraAdmin && !mantemAdmin) {
      throw new HttpError(400, "Você não pode remover o próprio perfil de administrador.");
    }
  }

  if (input.email) {
    const conflito = await prisma.usuario.findFirst({
      where: { email: input.email, id: { not: id } },
      select: { id: true },
    });
    if (conflito) {
      throw new HttpError(
        409,
        "Já existe um usuário com este e-mail. Confira o cadastro existente.",
        [{ campo: "email", mensagem: "Já existe um usuário com este e-mail." }],
      );
    }
  }

  const telefone = input.telefone === undefined ? undefined : normalizarTelefone(input.telefone);
  const setor =
    input.setor === undefined
      ? undefined
      : input.setor === null || !input.setor.trim()
        ? null
        : input.setor.trim();

  const perfilIds = input.perfis ? await resolverPerfilIds(input.perfis) : undefined;
  const inativando = input.ativo === false;

  let atualizado: UsuarioComPerfis;
  try {
    atualizado = await prisma.$transaction(async (tx) => {
      if (perfilIds) {
        await tx.usuarioPerfil.deleteMany({ where: { usuarioId: id } });
        await tx.usuarioPerfil.createMany({
          data: perfilIds.map((perfilId) => ({ usuarioId: id, perfilId })),
        });
      }

      const usuario = await tx.usuario.update({
        where: { id },
        data: {
          ...(input.nome !== undefined ? { nome: input.nome } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(telefone !== undefined ? { telefone } : {}),
          ...(setor !== undefined ? { setor } : {}),
          ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
        },
        select: usuarioSelect,
      });

      if (telefone !== undefined || input.ativo !== undefined) {
        await tx.motorista.updateMany({
          where: { usuarioId: id },
          data: {
            ...(telefone !== undefined ? { telefone } : {}),
            ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
          },
        });
      }

      if (inativando) {
        await tx.authSessao.deleteMany({ where: { usuarioId: id } });
      }

      return usuario;
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new HttpError(
        409,
        "Já existe um usuário com este e-mail. Confira o cadastro existente.",
        [{ campo: "email", mensagem: "Já existe um usuário com este e-mail." }],
      );
    }
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new HttpError(404, "Usuário não encontrado. Atualize a lista e tente novamente.");
    }
    throw erro;
  }

  const resposta = serializarUsuario(atualizado);
  await registrarAuditoriaUsuario(
    usuarioResponsavelId,
    "ATUALIZAR",
    resposta,
    inativando ? "INATIVAR" : undefined,
  );
  return resposta;
}

export async function inativarUsuario(id: string, usuarioResponsavelId: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "Não foi possível identificar o usuário. Selecione-o novamente.");
  }

  if (id === usuarioResponsavelId) {
    throw new HttpError(400, "Você não pode inativar a própria conta.");
  }

  const atual = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, ativo: true },
  });

  if (!atual) {
    throw new HttpError(404, "Usuário não encontrado. Atualize a lista e tente novamente.");
  }

  let atualizado: UsuarioComPerfis;
  try {
    atualizado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id },
        data: { ativo: false },
        select: usuarioSelect,
      });
      await tx.motorista.updateMany({
        where: { usuarioId: id },
        data: { ativo: false },
      });
      await tx.authSessao.deleteMany({ where: { usuarioId: id } });
      return usuario;
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new HttpError(404, "Usuário não encontrado. Atualize a lista e tente novamente.");
    }
    throw erro;
  }

  const resposta = serializarUsuario(atualizado);
  await registrarAuditoriaUsuario(usuarioResponsavelId, "ATUALIZAR", resposta, "INATIVAR");
  return resposta;
}
