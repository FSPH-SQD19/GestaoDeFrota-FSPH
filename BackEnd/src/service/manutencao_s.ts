import { Prisma, type Manutencao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { temNoMaximoDuasCasas, decimalParaNumero } from "./abastecimento_s";
import { HttpError } from "../middleware/http_m";

export const TIPOS_MANUTENCAO = ["PREVENTIVA", "CORRETIVA"] as const;

export const listarManutencoesSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }).optional(),
    tipo: z
      .enum(TIPOS_MANUTENCAO, { error: "Tipo de manutenção deve ser PREVENTIVA ou CORRETIVA." })
      .optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
  })
  .superRefine((filtros, ctx) => {
    if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
      ctx.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final deve ser igual ou depois da data inicial.",
      });
    }
  });

export const criarManutencaoSchema = z.object({
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

export type ManutencaoResposta = Omit<Manutencao, "odometroRegistro" | "custoTotal"> & {
  odometroRegistro: number | null;
  custoTotal: number | null;
};

export function serializarManutencao(manutencao: Manutencao): ManutencaoResposta {
  return {
    ...manutencao,
    odometroRegistro: decimalParaNumero(manutencao.odometroRegistro),
    custoTotal: decimalParaNumero(manutencao.custoTotal),
  };
}

export async function listarManutencoes(filtros: ListarManutencoesFiltros) {
  const { page, pageSize, veiculoId, tipo, dataInicio, dataFim } = filtros;

  const where: Prisma.ManutencaoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    tipo: tipo,
    dataManutencao: { gte: dataInicio, lte: dataFim },
  };

  const [manutencoes, total] = await Promise.all([
    prisma.manutencao.findMany({
      where,
      orderBy: [{ dataManutencao: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.manutencao.count({ where }),
  ]);

  return {
    data: manutencoes.map(serializarManutencao),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

const TIPO_CORRETIVA = "CORRETIVA";
const STATUS_EM_MANUTENCAO = "MANUTENCAO";

export async function criarManutencao(input: CriarManutencaoInput, usuarioId: string) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: input.veiculoId },
    select: { ativo: true, status: true },
  });
  if (!veiculo?.ativo) {
    throw new HttpError(422, "Veículo não encontrado ou inativo.", [
      { campo: "veiculoId", mensagem: "Informe um veículo ativo." },
    ]);
  }

  if (
    input.tipo === TIPO_CORRETIVA &&
    !["DISPONIVEL", STATUS_EM_MANUTENCAO].includes(veiculo.status)
  ) {
    throw new HttpError(422, "Status não está entre os permitidos", [
      { campo: "veiculoId", mensagem: "" },
    ]);
  }

  if (input.fornecedorId) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: input.fornecedorId },
      select: { ativo: true },
    });
    if (!fornecedor?.ativo) {
      throw new HttpError(422, "Fornecedor não encontrado ou inativo.", [
        { campo: "fornecedorId", mensagem: "Informe um fornecedor ativo." },
      ]);
    }
  }

  const manutencao = await prisma.$transaction(async (tx) => {
    const criada = await tx.manutencao.create({ data: input });

    if (input.tipo === TIPO_CORRETIVA) {
      await tx.veiculo.update({
        where: { id: input.veiculoId },
        data: { status: STATUS_EM_MANUTENCAO },
      });
    }

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "CRIAR",
        tabelaAfetada: "manutencoes",
        registroId: criada.id,
        dadosNovos: JSON.parse(JSON.stringify(serializarManutencao(criada))),
      },
    });
    return criada;
  });

  return serializarManutencao(manutencao);
}
