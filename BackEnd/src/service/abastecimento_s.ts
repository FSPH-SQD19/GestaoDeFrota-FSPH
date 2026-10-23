import { Prisma, type Abastecimento } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";

export const listarAbastecimentosSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }).optional(),
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

export const criarAbastecimentoSchema = z.object({
  veiculoId: z.uuid({ error: "veiculoId deve ser um UUID válido." }),
  motoristaId: z.uuid({ error: "motoristaId deve ser um UUID válido." }).optional(),
  fornecedorId: z.uuid({ error: "fornecedorId deve ser um UUID válido." }).optional(),
  dataHora: z.coerce.date().optional(),
  odometro: z
    .number({ error: "Odômetro deve ser numérico." })
    .min(0, "Odômetro não pode ser negativo.")
    .max(99999999.99, "Valor inválido.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  litros: z
    .number({ error: "Litros deve ser numérico." })
    .positive("Litros deve ser maior que 0.")
    .max(999999.99, "Quantidade de litros inválida.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  valorTotal: z
    .number({ error: "Valor Total deve ser numérico." })
    .positive("Valor Total deve ser maior que 0.")
    .max(99999999.99, "Valor inválido.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
});

export type CriarAbastecimentoInput = z.infer<typeof criarAbastecimentoSchema>;

export type ListarAbastecimentosFiltros = z.infer<typeof listarAbastecimentosSchema>;

export type AbastecimentoResposta = Omit<Abastecimento, "odometro" | "litros" | "valorTotal"> & {
  odometro: number | null;
  litros: number | null;
  valorTotal: number | null;
};

function decimalParaNumero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : Number(valor);
}

function temNoMaximoDuasCasas(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-9;
}

export function serializarAbastecimento(abastecimento: Abastecimento): AbastecimentoResposta {
  return {
    ...abastecimento,
    odometro: decimalParaNumero(abastecimento.odometro),
    litros: decimalParaNumero(abastecimento.litros),
    valorTotal: decimalParaNumero(abastecimento.valorTotal),
  };
}

type NumeroDecimal = Prisma.Decimal | number | null;

export function calcularKmPorLitro(
  odometro: NumeroDecimal,
  odometroAnterior: NumeroDecimal,
  litros: NumeroDecimal,
): number | null {
  if (odometro === null || odometroAnterior === null || litros === null) return null;
  
  const numLitros = new Prisma.Decimal(litros).toNumber();
  if (numLitros <= 0) return null;

  const kmPorLitro = new Prisma.Decimal(odometro)
    .minus(new Prisma.Decimal(odometroAnterior))
    .dividedBy(numLitros)
    .toDecimalPlaces(2);
    
  return kmPorLitro.toNumber();
}

export async function listarAbastecimentos(filtros: ListarAbastecimentosFiltros) {
  const { page, pageSize, veiculoId, dataInicio, dataFim } = filtros;

  const fimExclusivo = dataFim ? new Date(dataFim.getTime() + 24 * 60 * 60 * 1000) : undefined;

  const where: Prisma.AbastecimentoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    dataHora: { gte: dataInicio, lt: fimExclusivo },
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

const data = await Promise.all(
  abastecimentos.map(async (item) => {
    const anterior = item.odometro !== null
      ? await prisma.abastecimento.findFirst({
          where: { veiculoId: item.veiculoId, odometro: { lt: item.odometro } },
          orderBy: { odometro: "desc" },
          select: { odometro: true },
        })
      : null;

    return {
      ...serializarAbastecimento(item),
      kmPorLitro: calcularKmPorLitro(item.odometro, anterior?.odometro ?? null, item.litros),
    };
  })
);

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function criarAbastecimento(input: CriarAbastecimentoInput, usuarioId: string) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: input.veiculoId },
    select: { ativo: true },
  });
  if (!veiculo?.ativo) {
    throw new HttpError(422, "Veículo não encontrado ou inativo.", [
      { campo: "veiculoId", mensagem: "Informe um veículo ativo." },
    ]);
  }

  if (input.motoristaId) {
    const motorista = await prisma.motorista.findUnique({
      where: { id: input.motoristaId },
      select: { ativo: true },
    });
    if (!motorista?.ativo) {
      throw new HttpError(422, "Motorista não encontrado ou inativo.", [
        { campo: "motoristaId", mensagem: "Informe um motorista ativo." },
      ]);
    }
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

  const dataHora = input.dataHora ?? new Date();

  const anterior = await prisma.abastecimento.findFirst({
    where: {
      veiculoId: input.veiculoId,
      dataHora: { lte: dataHora },
      odometro: { not: null },
    },
    orderBy: [{ dataHora: "desc" }, { odometro: "desc" }],
    select: { odometro: true },
  });

  const proximo = await prisma.abastecimento.findFirst({
    where: {
       veiculoId: input.veiculoId,
      dataHora: { gt: dataHora },
      odometro: { not: null },
    },
    orderBy: [{ dataHora: "asc" }, { odometro: "asc" }],
    select: { odometro: true }
  });

  if (anterior?.odometro && anterior.odometro.gte(input.odometro)) {
    throw new HttpError(422, "Odômetro inválido.", [
      {
        campo: "odometro",
        mensagem: `Deve ser maior que o último registrado (${anterior.odometro} km).`,
      },
    ]);
  }

  if (proximo?.odometro && new Prisma.Decimal(proximo.odometro).lte(input.odometro)) {
    throw new HttpError(422, "Odômetro inválido.", [
    {
      campo: "odometro",
      mensagem: `Deve ser menor que o registrado depois (${proximo.odometro} km).`,
    },
  ]);
  }

  const abastecimento = await prisma.$transaction(async(tx) => {
    const criado = await tx.abastecimento.create({
    data: { ...input, dataHora },
  });

  await tx.auditoriaSistema.create({
    data: {
      usuarioId,
      acao: "CRIAR",
      tabelaAfetada: "abastecimentos",
      registroId: criado.id,
      dadosNovos: JSON.parse(JSON.stringify(serializarAbastecimento(criado))),
    },
  });

  return criado;
});
  
  const resposta = serializarAbastecimento(abastecimento);

  return {
    ...resposta,
    kmPorLitro: calcularKmPorLitro(input.odometro, anterior?.odometro ?? null, input.litros),
  };
}
