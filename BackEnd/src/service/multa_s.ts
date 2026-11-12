import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { registrarAuditoria } from "./auditoria_s";

const GRAVIDADES_MULTA = ["LEVE", "MEDIA", "GRAVE", "GRAVISSIMA"] as const;
const STATUS_MULTA = ["PENDENTE", "PAGA", "EM_RECURSO"] as const;

const PONTOS_POR_GRAVIDADE: Record<(typeof GRAVIDADES_MULTA)[number], number> = {
  LEVE: 3,
  MEDIA: 4,
  GRAVE: 5,
  GRAVISSIMA: 7,
};

const dataDateSchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((valor) => new Date(`${valor.slice(0, 10)}T00:00:00.000Z`));

const dataDateTimeSchema = z.iso
  .datetime({ offset: true, message: "Data e hora inválidas." })
  .transform((valor) => new Date(valor));

export const listarMultasSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    busca: z.string().trim().optional(),
    veiculoId: z.string().uuid("Veículo inválido.").optional(),
    motoristaId: z.string().uuid("Motorista inválido.").optional(),
    status: z.enum(STATUS_MULTA, { error: "Status de multa inválido." }).optional(),
    gravidade: z.enum(GRAVIDADES_MULTA, { error: "Gravidade de infração inválida." }).optional(),
    dataInicio: dataDateSchema.optional(),
    dataFim: dataDateSchema.optional(),
  })
  .superRefine((filtros, ctx) => {
    if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
      ctx.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final deve ser igual ou posterior à data inicial.",
      });
    }
  });

export const criarMultaSchema = z.object({
  autoInfracao: z
    .string()
    .trim()
    .min(3, "O auto de infração deve conter pelo menos 3 caracteres.")
    .max(50, "O auto de infração deve conter no máximo 50 caracteres."),
  veiculoId: z.string().uuid("Selecione um veículo válido."),
  motoristaId: z.string().uuid("Selecione um motorista válido.").optional().nullable(),
  solicitacaoId: z.string().uuid("Solicitação de viagem inválida.").optional().nullable(),
  dataHora: dataDateTimeSchema,
  gravidade: z.enum(GRAVIDADES_MULTA, {
    error: "A gravidade deve ser LEVE, MEDIA, GRAVE ou GRAVISSIMA.",
  }),
  pontos: z.coerce.number().int().min(0).max(30).optional(),
  valor: z.coerce
    .number({ error: "Informe o valor da multa." })
    .positive("O valor da multa deve ser maior que zero.")
    .max(99999.99, "Valor muito elevado."),
  descricao: z.string().trim().max(255).optional().nullable(),
  local: z.string().trim().max(200).optional().nullable(),
  orgaoEmissor: z.string().trim().max(50).optional().nullable(),
  status: z.enum(STATUS_MULTA).default("PENDENTE"),
  dataVencimento: dataDateSchema.optional().nullable(),
  dataPagamento: dataDateTimeSchema.optional().nullable(),
  observacoes: z.string().trim().max(500).optional().nullable(),
});

export const atualizarMultaSchema = z.object({
  status: z.enum(STATUS_MULTA, { error: "Status inválido." }).optional(),
  dataPagamento: dataDateTimeSchema.optional().nullable(),
  motoristaId: z.string().uuid("Motorista inválido.").optional().nullable(),
  observacoes: z.string().trim().max(500).optional().nullable(),
});

export type ListarMultasFiltros = z.infer<typeof listarMultasSchema>;
export type CriarMultaInput = z.infer<typeof criarMultaSchema>;
export type AtualizarMultaInput = z.infer<typeof atualizarMultaSchema>;

function serializarMulta<T extends { valor: Prisma.Decimal }>(
  multa: T,
): Omit<T, "valor"> & { valor: number } {
  return {
    ...multa,
    valor: Number(multa.valor),
  };
}

export async function listarMultas(filtros: ListarMultasFiltros) {
  const { page, pageSize, busca, veiculoId, motoristaId, status, gravidade, dataInicio, dataFim } =
    filtros;

  const where: Prisma.MultaInfracaoWhereInput = {
    ...(veiculoId ? { veiculoId } : {}),
    ...(motoristaId ? { motoristaId } : {}),
    ...(status ? { status } : {}),
    ...(gravidade ? { gravidade } : {}),
    ...(dataInicio || dataFim
      ? {
          dataHora: {
            ...(dataInicio ? { gte: dataInicio } : {}),
            ...(dataFim
              ? { lte: new Date(`${dataFim.toISOString().slice(0, 10)}T23:59:59.999Z`) }
              : {}),
          },
        }
      : {}),
    ...(busca
      ? {
          OR: [
            { autoInfracao: { contains: busca, mode: "insensitive" } },
            { veiculo: { placa: { contains: busca, mode: "insensitive" } } },
            { veiculo: { modelo: { contains: busca, mode: "insensitive" } } },
            { motorista: { usuario: { nome: { contains: busca, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [multas, total, agregados] = await Promise.all([
    prisma.multaInfracao.findMany({
      where,
      include: {
        veiculo: {
          select: { id: true, placa: true, modelo: true, tipoFrota: true },
        },
        motorista: {
          select: {
            id: true,
            numeroCnh: true,
            cpf: true,
            usuario: { select: { id: true, nome: true, email: true } },
          },
        },
        solicitacao: {
          select: { id: true, protocolo: true, destino: true },
        },
      },
      orderBy: [{ dataHora: "desc" }, { criadoEm: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.multaInfracao.count({ where }),
    prisma.multaInfracao.aggregate({
      where,
      _sum: { valor: true, pontos: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: multas.map(serializarMulta),
    meta: {
      total,
      totalPages,
      page,
      pageSize,
      valorTotal: Number(agregados._sum.valor ?? 0),
      totalPontos: agregados._sum.pontos ?? 0,
    },
  };
}

export async function obterMultaPorId(id: string) {
  const multa = await prisma.multaInfracao.findUnique({
    where: { id },
    include: {
      veiculo: {
        select: { id: true, placa: true, modelo: true, tipoFrota: true, propriedade: true },
      },
      motorista: {
        select: {
          id: true,
          numeroCnh: true,
          cpf: true,
          usuario: { select: { id: true, nome: true, email: true, telefone: true } },
        },
      },
      solicitacao: {
        select: { id: true, protocolo: true, origem: true, destino: true, motivo: true },
      },
    },
  });

  if (!multa) {
    throw new HttpError(404, "Multa ou infração não encontrada.");
  }

  return serializarMulta(multa);
}

export async function criarMulta(dados: CriarMultaInput, usuarioId?: string | null) {
  // 1. Validar se o auto de infração já existe
  const autoExistente = await prisma.multaInfracao.findUnique({
    where: { autoInfracao: dados.autoInfracao },
  });

  if (autoExistente) {
    throw new HttpError(
      409,
      `Já existe uma infração cadastrada com o auto "${dados.autoInfracao}".`,
    );
  }

  // 2. Validar veículo
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: dados.veiculoId },
  });

  if (!veiculo || !veiculo.ativo) {
    throw new HttpError(400, "O veículo informado não foi encontrado ou está inativo.");
  }

  // 3. Validar motorista (se fornecido)
  if (dados.motoristaId) {
    const motorista = await prisma.motorista.findUnique({
      where: { id: dados.motoristaId },
    });
    if (!motorista || !motorista.ativo) {
      throw new HttpError(400, "O motorista informado não foi encontrado ou está inativo.");
    }
  }

  // 4. Validar solicitação (se fornecida)
  if (dados.solicitacaoId) {
    const solicitacao = await prisma.solicitacaoViagem.findUnique({
      where: { id: dados.solicitacaoId },
    });
    if (!solicitacao) {
      throw new HttpError(400, "A solicitação de viagem informada não foi encontrada.");
    }
  }

  // 5. Pontos padrão conforme gravidade se não informado
  const pontos = dados.pontos ?? PONTOS_POR_GRAVIDADE[dados.gravidade];

  const novaMulta = await prisma.multaInfracao.create({
    data: {
      autoInfracao: dados.autoInfracao,
      veiculoId: dados.veiculoId,
      motoristaId: dados.motoristaId ?? null,
      solicitacaoId: dados.solicitacaoId ?? null,
      dataHora: dados.dataHora,
      gravidade: dados.gravidade,
      pontos,
      valor: dados.valor,
      descricao: dados.descricao ?? null,
      local: dados.local ?? null,
      orgaoEmissor: dados.orgaoEmissor ?? null,
      status: dados.status,
      dataVencimento: dados.dataVencimento ?? null,
      dataPagamento: dados.dataPagamento ?? null,
      observacoes: dados.observacoes ?? null,
    },
    include: {
      veiculo: { select: { placa: true, modelo: true } },
      motorista: { select: { numeroCnh: true, usuario: { select: { nome: true } } } },
    },
  });

  await registrarAuditoria({
    usuarioId,
    acao: "CRIAR_MULTA",
    tabelaAfetada: "multas_infracoes",
    registroId: novaMulta.id,
    dadosNovos: {
      autoInfracao: novaMulta.autoInfracao,
      veiculoId: novaMulta.veiculoId,
      motoristaId: novaMulta.motoristaId,
      valor: dados.valor,
      pontos,
      status: novaMulta.status,
    },
  });

  return serializarMulta(novaMulta);
}

export async function atualizarMulta(
  id: string,
  dados: AtualizarMultaInput,
  usuarioId?: string | null,
) {
  const multaAtual = await prisma.multaInfracao.findUnique({
    where: { id },
  });

  if (!multaAtual) {
    throw new HttpError(404, "Multa ou infração não encontrada.");
  }

  if (dados.motoristaId) {
    const motorista = await prisma.motorista.findUnique({
      where: { id: dados.motoristaId },
    });
    if (!motorista || !motorista.ativo) {
      throw new HttpError(400, "O motorista informado não foi encontrado ou está inativo.");
    }
  }

  const multaAtualizada = await prisma.multaInfracao.update({
    where: { id },
    data: {
      ...(dados.status !== undefined ? { status: dados.status } : {}),
      ...(dados.dataPagamento !== undefined ? { dataPagamento: dados.dataPagamento } : {}),
      ...(dados.motoristaId !== undefined ? { motoristaId: dados.motoristaId } : {}),
      ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
    },
    include: {
      veiculo: { select: { placa: true, modelo: true } },
      motorista: { select: { numeroCnh: true, usuario: { select: { nome: true } } } },
    },
  });

  await registrarAuditoria({
    usuarioId,
    acao: "ATUALIZAR_MULTA",
    tabelaAfetada: "multas_infracoes",
    registroId: multaAtualizada.id,
    dadosNovos: {
      statusAnterior: multaAtual.status,
      statusNovo: multaAtualizada.status,
      dataPagamento: multaAtualizada.dataPagamento,
      motoristaId: multaAtualizada.motoristaId,
    },
  });

  return serializarMulta(multaAtualizada);
}

export async function obterResumoMultasMotorista(motoristaId: string) {
  const agora = new Date();
  const umAnoAtras = new Date(agora);
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);

  const multas = await prisma.multaInfracao.findMany({
    where: { motoristaId },
    include: {
      veiculo: { select: { placa: true, modelo: true } },
    },
    orderBy: { dataHora: "desc" },
  });

  let totalPontos = 0;
  let valorTotal = 0;

  const multasMapeadas = multas.map((m) => {
    const dataInfracao = new Date(m.dataHora);
    const expirada = dataInfracao < umAnoAtras;
    const pontosValidos = !expirada && m.status !== "ANULADA";

    if (pontosValidos) {
      totalPontos += m.pontos;
    }
    const valorNum = Number(m.valor);
    valorTotal += valorNum;

    return {
      ...serializarMulta(m),
      pontosAtivos: pontosValidos ? m.pontos : 0,
      expirada,
    };
  });

  return {
    totalMultas: multas.length,
    totalPontos,
    valorTotal,
    multas: multasMapeadas,
  };
}
