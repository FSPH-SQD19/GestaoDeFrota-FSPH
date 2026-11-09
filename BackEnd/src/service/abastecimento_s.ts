import { Prisma, type Abastecimento } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { STATUS_ORDEM_EM_COLETA } from "./svo_s";

export const listarAbastecimentosSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    veiculoId: z.uuid({ error: "Selecione um veículo válido." }).optional(),
    motoristaId: z.uuid({ error: "Selecione um motorista válido." }).optional(),
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
  veiculoId: z.uuid({ error: "Selecione um veículo válido." }),
  motoristaId: z.uuid({ error: "Selecione um motorista válido." }).optional(),
  fornecedorId: z.uuid({ error: "Selecione um fornecedor válido." }).optional(),
  dataHora: z.coerce.date().optional(),
  odometro: z
    .number({ error: "Informe a quilometragem exibida no odômetro." })
    .min(0, "Odômetro não pode ser negativo.")
    .max(99999999.99, "Valor inválido.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  litros: z
    .number({ error: "Informe a quantidade abastecida em litros." })
    .positive("Litros deve ser maior que 0.")
    .max(999999.99, "Quantidade de litros inválida.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  valorTotal: z
    .number({ error: "Informe o valor total do abastecimento." })
    .positive("Valor Total deve ser maior que 0.")
    .max(99999999.99, "Valor inválido.")
    .refine(temNoMaximoDuasCasas, "Use no máximo 2 casas decimais."),
  postoCredenciado: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z
      .string({ error: "Informe o nome do posto credenciado." })
      .trim()
      .max(150, "Posto credenciado deve ter no máximo 150 caracteres.")
      .nullish()
      .transform((valor) => valor ?? undefined),
  ),
});

export type CriarAbastecimentoInput = z.infer<typeof criarAbastecimentoSchema>;

export type ListarAbastecimentosFiltros = z.infer<typeof listarAbastecimentosSchema>;

export type AbastecimentoResposta = Omit<Abastecimento, "odometro" | "litros" | "valorTotal"> & {
  odometro: number | null;
  litros: number | null;
  valorTotal: number | null;
};

export function decimalParaNumero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : Number(valor);
}

export function temNoMaximoDuasCasas(valor: number): boolean {
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
  const { page, pageSize, veiculoId, motoristaId, dataInicio, dataFim } = filtros;

  const fimExclusivo = dataFim ? new Date(dataFim.getTime() + 24 * 60 * 60 * 1000) : undefined;

  const where: Prisma.AbastecimentoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    ...(motoristaId ? { motoristaId } : {}),
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
      const anterior =
        item.odometro !== null
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
    }),
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
    select: { odometro: true },
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

  const abastecimento = await prisma.$transaction(async (tx) => {
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

export const criarAbastecimentoMotoristaSchema = criarAbastecimentoSchema
  .omit({ motoristaId: true, dataHora: true })
  .extend({ veiculoId: z.uuid({ error: "Selecione um veículo válido." }).optional() });

export type CriarAbastecimentoMotoristaInput = z.infer<typeof criarAbastecimentoMotoristaSchema>;

async function motoristaDoUsuario(usuarioId: string) {
  const motorista = await prisma.motorista.findUnique({
    where: { usuarioId },
    select: { id: true, ativo: true },
  });
  if (!motorista?.ativo) {
    throw new HttpError(403, "Seu usuário não está vinculado a um motorista ativo.");
  }
  return motorista.id;
}

// Veículos de viagens EM_TRANSITO ou coletas SVO em andamento do motorista.
export async function veiculosEmExecucao(motoristaId: string) {
  const [viagens, ordens] = await Promise.all([
    prisma.solicitacaoViagem.findMany({
      where: { motoristaAlocadoId: motoristaId, status: "EM_TRANSITO" },
      select: { veiculoAlocadoId: true },
    }),
    prisma.ordemColetaSvo.findMany({
      where: { motoristaId, status: { in: [...STATUS_ORDEM_EM_COLETA] } },
      select: { veiculoId: true },
    }),
  ]);
  const ids = [
    ...viagens.map((viagem) => viagem.veiculoAlocadoId),
    ...ordens.map((ordem) => ordem.veiculoId),
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export async function criarAbastecimentoMotorista(
  input: CriarAbastecimentoMotoristaInput,
  usuarioId: string,
) {
  const motoristaId = await motoristaDoUsuario(usuarioId);
  const emExecucao = await veiculosEmExecucao(motoristaId);

  if (emExecucao.length === 0) {
    throw new HttpError(422, "Você não tem viagem ou coleta em andamento.", [
      {
        campo: "veiculoId",
        mensagem: "Inicie a viagem ou a coleta antes de registrar o abastecimento.",
      },
    ]);
  }

  let veiculoId = input.veiculoId;
  if (!veiculoId) {
    if (emExecucao.length > 1) {
      throw new HttpError(422, "Selecione o veículo abastecido.", [
        { campo: "veiculoId", mensagem: "Há mais de um veículo em andamento com você." },
      ]);
    }
    veiculoId = emExecucao[0]!;
  } else if (!emExecucao.includes(veiculoId)) {
    throw new HttpError(422, "Veículo fora da sua viagem ou coleta em andamento.", [
      { campo: "veiculoId", mensagem: "Informe o veículo da viagem ou coleta em andamento." },
    ]);
  }

  return criarAbastecimento({ ...input, veiculoId, motoristaId }, usuarioId);
}

export async function listarMeusAbastecimentos(
  filtros: ListarAbastecimentosFiltros,
  usuarioId: string,
) {
  const motoristaId = await motoristaDoUsuario(usuarioId);
  return listarAbastecimentos({ ...filtros, motoristaId });
}
