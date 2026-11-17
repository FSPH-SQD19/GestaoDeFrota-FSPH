import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { bloquearVeiculo, transacionarManutencao } from "./manutencao_s";

export const SITUACOES_AVARIA = ["PENDENTE", "LIBERADA", "ENCAMINHADA_MANUTENCAO"] as const;

export const listarAvariasSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  veiculoId: z.uuid({ error: "Selecione um veículo válido." }).optional(),
  situacao: z.enum(SITUACOES_AVARIA).optional(),
});

export const analisarAvariaSchema = z
  .object({
    decisao: z.enum(["LIBERAR", "ENCAMINHAR_MANUTENCAO"]),
    justificativa: z
      .string()
      .trim()
      .min(5, "A justificativa deve ter ao menos 5 caracteres.")
      .max(500, "A justificativa deve ter no máximo 500 caracteres."),
  })
  .strict();

export type ListarAvariasFiltros = z.infer<typeof listarAvariasSchema>;
export type AnalisarAvariaInput = z.infer<typeof analisarAvariaSchema>;

const incluirAvaria = {
  veiculo: { select: { id: true, placa: true, modelo: true, status: true, ativo: true } },
  solicitacao: { select: { id: true, protocolo: true, origem: true, destino: true } },
  registradaPor: { select: { id: true, nome: true } },
  analisadaPor: { select: { id: true, nome: true } },
  manutencao: { select: { id: true, tipo: true, status: true, descricao: true } },
} satisfies Prisma.AvariaViagemInclude;

export async function listarAvarias(filtros: ListarAvariasFiltros) {
  const where: Prisma.AvariaViagemWhereInput = {
    ...(filtros.veiculoId ? { veiculoId: filtros.veiculoId } : {}),
    ...(filtros.situacao ? { situacao: filtros.situacao } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.avariaViagem.findMany({
      where,
      include: incluirAvaria,
      orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.avariaViagem.count({ where }),
  ]);
  return {
    data,
    meta: {
      page: filtros.page,
      pageSize: filtros.pageSize,
      total,
      totalPages: Math.ceil(total / filtros.pageSize),
    },
  };
}

export async function listarVeiculosComAvaria() {
  return prisma.veiculo.findMany({
    where: { avarias: { some: {} } },
    select: { id: true, placa: true, modelo: true },
    orderBy: { placa: "asc" },
  });
}

export async function historicoAvaria(id: string) {
  const existe = await prisma.avariaViagem.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw new HttpError(404, "Avaria não encontrada.");
  return prisma.avariaHistorico.findMany({
    where: { avariaId: id },
    include: {
      autor: { select: { id: true, nome: true } },
      manutencao: { select: { id: true, status: true, descricao: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
}

export async function analisarAvaria(id: string, input: AnalisarAvariaInput, usuarioId: string) {
  const referencia = await prisma.avariaViagem.findUnique({
    where: { id },
    select: { veiculoId: true },
  });
  if (!referencia) throw new HttpError(404, "Avaria não encontrada.");

  return transacionarManutencao(async (tx) => {
    await bloquearVeiculo(tx, referencia.veiculoId);
    await tx.$queryRaw`SELECT id FROM avarias_viagem WHERE id = ${id}::uuid FOR UPDATE`;

    const avaria = await tx.avariaViagem.findUnique({
      where: { id },
      include: {
        ...incluirAvaria,
        execucao: { select: { kmFinal: true } },
      },
    });
    if (!avaria) throw new HttpError(404, "Avaria não encontrada.");

    const situacaoDestino = input.decisao === "LIBERAR" ? "LIBERADA" : "ENCAMINHADA_MANUTENCAO";
    if (avaria.situacao === situacaoDestino && avaria.justificativa === input.justificativa) {
      return avaria;
    }
    if (avaria.situacao !== "PENDENTE") {
      throw new HttpError(409, "Esta avaria já foi analisada.");
    }

    const veiculo = await tx.veiculo.findUnique({
      where: { id: avaria.veiculoId },
      select: { id: true, ativo: true, status: true, odometroAtual: true, placa: true },
    });
    if (!veiculo) throw new HttpError(404, "Veículo da avaria não encontrado.");

    const agora = new Date();
    let manutencao: {
      id: string;
      tipo: string | null;
      status: string;
      descricao: string | null;
    } | null = null;

    if (input.decisao === "LIBERAR") {
      const [outrasAvariasPendentes, manutencoesAbertas] = await Promise.all([
        tx.avariaViagem.count({
          where: { veiculoId: avaria.veiculoId, situacao: "PENDENTE", id: { not: id } },
        }),
        tx.manutencao.count({ where: { veiculoId: avaria.veiculoId, status: "ABERTA" } }),
      ]);
      if (outrasAvariasPendentes > 0 || manutencoesAbertas > 0) {
        throw new HttpError(
          409,
          "O veículo possui outra avaria pendente ou manutenção aberta e não pode ser liberado.",
        );
      }
      if (veiculo.ativo && veiculo.status === "EM_VIAGEM") {
        throw new HttpError(409, "O veículo está em outra viagem e não pode ser liberado.");
      }
      if (veiculo.ativo && veiculo.status === "MANUTENCAO") {
        await tx.veiculo.updateMany({
          where: { id: veiculo.id, ativo: true, status: "MANUTENCAO" },
          data: { status: "DISPONIVEL" },
        });
      }
    } else {
      if (veiculo.status === "EM_VIAGEM") {
        throw new HttpError(409, "O veículo está em outra viagem e não pode ser encaminhado.");
      }
      const data = new Date(agora);
      data.setUTCHours(0, 0, 0, 0);
      const odometroManutencao = avaria.execucao.kmFinal ?? veiculo.odometroAtual;
      manutencao = await tx.manutencao.create({
        data: {
          veiculoId: veiculo.id,
          avariaId: id,
          tipo: "CORRETIVA",
          descricao: `Avaria da viagem ${avaria.solicitacao.protocolo}: ${avaria.descricao}\n\nAvaliação: ${input.justificativa}`,
          odometroRegistro: odometroManutencao,
          custoTotal: null,
          dataManutencao: data,
          status: "ABERTA",
        },
        select: { id: true, tipo: true, status: true, descricao: true },
      });
      await tx.veiculo.updateMany({
        where: { id: veiculo.id, status: { not: "MANUTENCAO" } },
        data: { status: "MANUTENCAO" },
      });
      await tx.auditoriaSistema.create({
        data: {
          usuarioId,
          acao: "CRIAR_AVARIA",
          tabelaAfetada: "manutencoes",
          registroId: manutencao.id,
          dadosNovos: {
            avariaId: id,
            veiculoId: veiculo.id,
            tipo: "CORRETIVA",
            status: "ABERTA",
            odometroRegistro: Number(odometroManutencao),
          },
        },
      });
    }

    const atualizada = await tx.avariaViagem.update({
      where: { id },
      data: {
        situacao: situacaoDestino,
        analisadaPorId: usuarioId,
        analisadaEm: agora,
        justificativa: input.justificativa,
      },
      include: incluirAvaria,
    });
    await tx.avariaHistorico.create({
      data: {
        avariaId: id,
        autorId: usuarioId,
        situacaoAnterior: "PENDENTE",
        situacaoNova: situacaoDestino,
        justificativa: input.justificativa,
        ...(manutencao ? { manutencaoId: manutencao.id } : {}),
      },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: situacaoDestino,
        tabelaAfetada: "avarias_viagem",
        registroId: id,
        dadosNovos: {
          decisao: input.decisao,
          situacaoAnterior: "PENDENTE",
          situacaoNova: situacaoDestino,
          justificativa: input.justificativa,
          manutencaoId: manutencao?.id ?? null,
          analisadaEm: agora.toISOString(),
        },
      },
    });

    return { ...atualizada, manutencao };
  });
}
