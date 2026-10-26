import { Prisma, type Manutencao } from "@prisma/client";
import { z } from "zod";
import { temNoMaximoDuasCasas } from "./abastecimento_s";

export const TIPOS_MANUTENCAO = ["PREVENTIVA", "CORRETIVA"] as const;

export const listarManutencoesSchema = z
    .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }).optional(),
    tipo: z.enum(TIPOS_MANUTENCAO, { error: "Tipo de manutenção deve ser PREVENTIVA ou CORRETIVA." }).optional(),
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

export const criarManutencaoSchema = z
    .object({
    veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }),
    fornecedorId: z.uuid({ error: "fornecedorId deve ser um UUID válido." }).optional(),
    tipo: z.enum(TIPOS_MANUTENCAO, { error: "Tipo de manutenção deve ser PREVENTIVA ou CORRETIVA." }),
    descricao: z.string().trim().min(3, "Descrição deve ter ao menos 3 caracteres.").optional(),
    odometroRegistro: z
        .number({ error: "Odômetro deve ser numérico." })
        .min(0, "Odômetro não pode ser negativo.")
        .max(99999999.99, "Valor inválido.")
        .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
    custoTotal: z
        .number({ error: "Valor Total deve ser numérico." })
        .positive("Valor Total deve ser maior que 0.")
        .max(9999999999.99, "Valor inválido.")
        .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
    dataManutencao: z.coerce.date(),
});

export type ListarManutencoesFiltros = z.infer<typeof listarManutencoesSchema>;
export type CriarManutencaoInput = z.infer<typeof criarManutencaoSchema>;