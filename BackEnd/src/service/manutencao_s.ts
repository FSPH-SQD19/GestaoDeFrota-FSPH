import { Prisma, type Manutencao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { temNoMaximoDuasCasas, decimalParaNumero } from "./abastecimento_s";
import { HttpError } from "../middleware/http_m";

export const TIPOS_MANUTENCAO = ["PREVENTIVA", "CORRETIVA"] as const;

const STATUS_EM_MANUTENCAO = "MANUTENCAO";
const STATUS_DISPONIVEL = "DISPONIVEL";
export const MANUTENCAO_ABERTA = "ABERTA" as const;
export const MANUTENCAO_CONCLUIDA = "CONCLUIDA" as const;
export const TIPO_CORRETIVA = "CORRETIVA" as const;

const dataSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform((valor) => {
  return new Date(`${valor.slice(0, 10)}T00:00:00.000Z`);
});

export const listarManutencoesSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }).optional(),
    tipo: z
      .enum(TIPOS_MANUTENCAO, { error: "Tipo de manutenção deve ser PREVENTIVA ou CORRETIVA." })
      .optional(),
    dataInicio: dataSchema.optional(),
    dataFim: dataSchema.optional(),
    status: z
      .enum([MANUTENCAO_ABERTA, MANUTENCAO_CONCLUIDA], {
        error: "Status deve ser ABERTA ou CONCLUIDA.",
      })
      .optional(),
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
    .number({ error: "Custo Total deve ser numérico." })
    .positive("Custo Total deve ser maior que 0.")
    .max(9999999999.99, "Valor inválido.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  dataManutencao: dataSchema,
});

export const manutencaoIdSchema = z.object({
  id: z.uuid({ error: "id deve ser um UUID válido." }),
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
  const { page, pageSize, veiculoId, tipo, dataInicio, dataFim, status } = filtros;

  const where: Prisma.ManutencaoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    tipo: tipo,
    status: status,
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

async function bloquearVeiculo(tx: Prisma.TransactionClient, veiculoId: string) {
  // Compartilha a trava com a aprovação de solicitações para o mesmo veículo.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`veiculo:${veiculoId}`}, 0))`;
  await tx.$queryRaw`SELECT id FROM veiculos WHERE id = ${veiculoId}::uuid FOR UPDATE`;
}

async function transacionar<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(operacao, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2028"].includes(error.code)
    ) {
      throw new HttpError(409, "Manutenção em processamento. Tente novamente.");
    }
    throw error;
  }
}

export async function criarManutencao(input: CriarManutencaoInput, usuarioId: string) {
  const manutencao = await transacionar(async (tx) => {
    await bloquearVeiculo(tx, input.veiculoId);
    const veiculo = await tx.veiculo.findUnique({
      where: { id: input.veiculoId },
      select: { ativo: true, status: true },
    });
    if (!veiculo?.ativo) {
      throw new HttpError(422, "Veículo não encontrado ou inativo.", [
        { campo: "veiculoId", mensagem: "Informe um veículo ativo." },
      ]);
    }
    const corretiva = input.tipo === TIPO_CORRETIVA;
    if (corretiva && ![STATUS_DISPONIVEL, STATUS_EM_MANUTENCAO].includes(veiculo.status)) {
      throw new HttpError(422, "Veículo indisponível para manutenção corretiva.", [
        {
          campo: "veiculoId",
          mensagem: `Veículo com status ${veiculo.status} não pode entrar em manutenção corretiva.`,
        },
      ]);
    }
    if (input.fornecedorId) {
      const fornecedor = await tx.fornecedor.findUnique({
        where: { id: input.fornecedorId },
        select: { ativo: true },
      });
      if (!fornecedor?.ativo) {
        throw new HttpError(422, "Fornecedor não encontrado ou inativo.", [
          { campo: "fornecedorId", mensagem: "Informe um fornecedor ativo." },
        ]);
      }
    }
    const criada = await tx.manutencao.create({
      data: {
        ...input,
        status: corretiva ? MANUTENCAO_ABERTA : MANUTENCAO_CONCLUIDA,
        dataConclusao: corretiva ? null : input.dataManutencao,
      },
    });
    if (corretiva) {
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

export async function concluirManutencao(id: string, usuarioId: string) {
  const manutencao = await prisma.manutencao.findUnique({
    where: { id },
    select: { veiculoId: true },
  });
  if (!manutencao) throw new HttpError(404, "Manutenção não encontrada.");

  return transacionar(async (tx) => {
    await bloquearVeiculo(tx, manutencao.veiculoId);
    const alteracao = await tx.manutencao.updateMany({
      where: { id, status: MANUTENCAO_ABERTA },
      data: { status: MANUTENCAO_CONCLUIDA, dataConclusao: new Date() },
    });
    if (alteracao.count !== 1) {
      const existente = await tx.manutencao.findUnique({ where: { id }, select: { id: true } });
      throw new HttpError(
        existente ? 422 : 404,
        existente ? "Manutenção não está aberta." : "Manutenção não encontrada.",
      );
    }
    const concluida = await tx.manutencao.findUniqueOrThrow({ where: { id } });
    const outrasAbertas = await tx.manutencao.count({
      where: { veiculoId: manutencao.veiculoId, status: MANUTENCAO_ABERTA, id: { not: id } },
    });
    if (outrasAbertas === 0) {
      await tx.veiculo.updateMany({
        where: { id: manutencao.veiculoId, ativo: true, status: STATUS_EM_MANUTENCAO },
        data: { status: STATUS_DISPONIVEL },
      });
    }
    const veiculo = await tx.veiculo.findUniqueOrThrow({
      where: { id: manutencao.veiculoId },
      select: { status: true },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "CONCLUIR",
        tabelaAfetada: "manutencoes",
        registroId: id,
        dadosNovos: JSON.parse(JSON.stringify(serializarManutencao(concluida))),
      },
    });
    return { manutencao: serializarManutencao(concluida), statusVeiculo: veiculo.status };
  });
}
