import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export type RegistrarAuditoriaInput = {
  usuarioId?: string | null;
  acao: string;
  tabelaAfetada: string;
  registroId?: string | null;
  dadosNovos: Prisma.InputJsonValue;
};

export function registrarAuditoria({
  usuarioId = null,
  acao,
  tabelaAfetada,
  registroId = null,
  dadosNovos,
}: RegistrarAuditoriaInput) {
  return prisma.auditoriaSistema.create({
    data: {
      usuarioId,
      acao,
      tabelaAfetada,
      registroId,
      dadosNovos,
    },
  });
}

const CAMPOS_SENSIVEIS = new Set([
  "senha",
  "senhahash",
  "senha_hash",
  "password",
  "token",
  "novasenha",
  "senhaatual",
  "secret",
]);

export function sanitizarLgpd(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) {
    return valor.map(sanitizarLgpd);
  }
  if (typeof valor === "object") {
    const limpo: Record<string, unknown> = {};
    for (const [chave, val] of Object.entries(valor as Record<string, unknown>)) {
      if (CAMPOS_SENSIVEIS.has(chave.toLowerCase())) {
        limpo[chave] = "******";
      } else {
        limpo[chave] = sanitizarLgpd(val);
      }
    }
    return limpo;
  }
  return valor;
}

export const listarAuditoriaSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tabelaAfetada: z
    .preprocess(
      (v) => (v === "TODAS" || v === "" || v === undefined ? undefined : v),
      z.string().trim().max(50).optional(),
    )
    .optional(),
  acao: z
    .preprocess(
      (v) => (v === "TODAS" || v === "" || v === undefined ? undefined : v),
      z.string().trim().max(50).optional(),
    )
    .optional(),
  usuarioId: z
    .preprocess(
      (v) => (v === "TODOS" || v === "" || v === undefined ? undefined : v),
      z.string().trim().uuid().optional(),
    )
    .optional(),
  dataInicio: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00-03:00`) : undefined))
    .optional(),
  dataFim: z
    .string()
    .trim()
    .optional()
    .transform((v) =>
      v ? new Date(new Date(`${v}T00:00:00-03:00`).getTime() + 86400000 - 1) : undefined,
    )
    .optional(),
  busca: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined))
    .optional(),
});

export type ListarAuditoriaParams = z.infer<typeof listarAuditoriaSchema>;

export async function listarAuditoria(filtros: ListarAuditoriaParams) {
  const { page, pageSize, tabelaAfetada, acao, usuarioId, dataInicio, dataFim, busca } = filtros;

  const where: Prisma.AuditoriaSistemaWhereInput = {
    ...(tabelaAfetada ? { tabelaAfetada } : {}),
    ...(acao ? { acao } : {}),
    ...(usuarioId ? { usuarioId } : {}),
    ...(dataInicio || dataFim
      ? {
          criadoEm: {
            ...(dataInicio ? { gte: dataInicio } : {}),
            ...(dataFim ? { lte: dataFim } : {}),
          },
        }
      : {}),
    ...(busca
      ? {
          OR: [
            { acao: { contains: busca, mode: "insensitive" } },
            { tabelaAfetada: { contains: busca, mode: "insensitive" } },
            { usuario: { nome: { contains: busca, mode: "insensitive" } } },
            { usuario: { email: { contains: busca, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [registros, total] = await Promise.all([
    prisma.auditoriaSistema.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            setor: true,
          },
        },
      },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditoriaSistema.count({ where }),
  ]);

  const data = registros.map((r) => ({
    ...r,
    dadosNovos: sanitizarLgpd(r.dadosNovos),
  }));

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}
