import { Abastecimento, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";
import { registrarAuditoria } from "./auditoria_s";

export const listarAbastecimentosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
}).superRefine((filtros, ctx) => {
    if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
      ctx.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final deve ser igual ou depois da data inicial.",
      });
    }
  });

export type ListarAbastecimentosFiltros = z.infer<typeof listarAbastecimentosSchema>;

export type AbastecimentoResposta = Omit<Abastecimento, "odometro" | "litros" | "valorTotal"> & {
  odometro: number | null;
  litros: number | null;
  valorTotal: number | null;
};

function decimalParaNumero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : Number(valor);
}

export function serializarAbastecimento(abastecimento: Abastecimento): AbastecimentoResposta {
  return {
    ...abastecimento,
    odometro: decimalParaNumero(abastecimento.odometro),
    litros: decimalParaNumero(abastecimento.litros),
    valorTotal: decimalParaNumero(abastecimento.valorTotal),
  };
}

export async function listarAbastecimentos(filtros: ListarAbastecimentosFiltros) {
  const { page, pageSize, veiculoId, dataInicio, dataFim } = filtros;

  const where: Prisma.AbastecimentoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    dataHora: { gte: dataInicio, lte: dataFim },
  };

  const [abastecimentos, total] = await Promise.all([
    prisma.abastecimento.findMany({
      where,
      orderBy: [{ dataHora: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.abastecimento.count({ where }),
  ]);

  return {
    data: abastecimentos.map(serializarAbastecimento),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}