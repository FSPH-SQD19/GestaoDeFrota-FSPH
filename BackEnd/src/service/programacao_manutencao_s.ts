import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { bloquearVeiculo, transacionarManutencao } from "./manutencao_s";

const janelaSchema = {
  veiculoId: z.uuid(),
  inicioPrevisto: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
  fimPrevisto: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
};

export const programarManutencaoSchema = z
  .object({
    ...janelaSchema,
    fornecedorId: z.uuid().nullable().default(null),
    descricao: z.string().trim().max(2000).nullable().default(null),
  })
  .refine((dados) => dados.inicioPrevisto < dados.fimPrevisto, {
    path: ["fimPrevisto"],
    message: "O fim deve ser posterior ao início da manutenção.",
  });
export const reagendarManutencaoSchema = programarManutencaoSchema.safeExtend({
  versao: z.number().int().nonnegative(),
});
export const cancelarProgramacaoSchema = z.object({ versao: z.number().int().nonnegative() });
export const conflitosProgramacaoSchema = z
  .object({
    ...janelaSchema,
    ignorarId: z.uuid().optional(),
  })
  .refine((dados) => dados.inicioPrevisto < dados.fimPrevisto, {
    path: ["fimPrevisto"],
    message: "O fim deve ser posterior ao início da manutenção.",
  });
export const listarProgramacoesSchema = z.object({
  veiculoId: z.uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

type ProgramacaoInput = z.infer<typeof programarManutencaoSchema>;
type Janela = z.infer<typeof conflitosProgramacaoSchema>;

export async function conflitosProgramacao(dados: Janela, tx: Prisma.TransactionClient = prisma) {
  const [viagens, manutencoes] = await Promise.all([
    tx.solicitacaoViagem.findMany({
      where: {
        veiculoAlocadoId: dados.veiculoId,
        status: { in: ["APROVADA", "EM_TRANSITO"] },
        dataHoraPretendida: { lt: dados.fimPrevisto },
        dataHoraRetornoPrevista: { gt: dados.inicioPrevisto },
      },
      select: {
        id: true,
        protocolo: true,
        status: true,
        dataHoraPretendida: true,
        dataHoraRetornoPrevista: true,
      },
      orderBy: { dataHoraPretendida: "asc" },
    }),
    tx.manutencao.findMany({
      where: {
        veiculoId: dados.veiculoId,
        status: "PROGRAMADA",
        inicioPrevisto: { lt: dados.fimPrevisto },
        fimPrevisto: { gt: dados.inicioPrevisto },
        ...(dados.ignorarId ? { id: { not: dados.ignorarId } } : {}),
      },
      select: { id: true, inicioPrevisto: true, fimPrevisto: true },
      orderBy: { inicioPrevisto: "asc" },
    }),
  ]);
  return { viagens, manutencoes };
}

export async function exigirSemReservaPreventiva(
  tx: Prisma.TransactionClient,
  veiculoId: string,
  inicio: Date,
  fim: Date,
) {
  const conflito = await tx.manutencao.findFirst({
    where: {
      veiculoId,
      status: "PROGRAMADA",
      inicioPrevisto: { lt: fim },
      fimPrevisto: { gt: inicio },
    },
    select: { id: true },
  });
  if (conflito)
    throw new HttpError(409, "O veículo possui manutenção preventiva programada neste horário.");
}

export async function historicoProgramacoes(ids: string[]) {
  if (!ids.length) return new Map();
  const alteracoes = await prisma.auditoriaSistema.findMany({
    where: {
      tabelaAfetada: "manutencoes",
      registroId: { in: ids },
      acao: { in: ["PROGRAMAR", "REAGENDAR", "CANCELAR"] },
    },
    select: {
      id: true,
      registroId: true,
      acao: true,
      criadoEm: true,
      dadosNovos: true,
      usuario: { select: { nome: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
  const historico = new Map<
    string,
    {
      id: string;
      acao: string | null;
      criadoEm: Date;
      autor: string;
      dados: Prisma.JsonValue | null;
    }[]
  >();
  for (const alteracao of alteracoes) {
    if (!alteracao.registroId) continue;
    const itens = historico.get(alteracao.registroId) ?? [];
    itens.push({
      id: alteracao.id,
      acao: alteracao.acao,
      criadoEm: alteracao.criadoEm,
      autor: alteracao.usuario?.nome ?? "Usuário indisponível",
      dados: alteracao.dadosNovos,
    });
    historico.set(alteracao.registroId, itens);
  }
  return historico;
}

export async function listarProgramacoes(dados: z.infer<typeof listarProgramacoesSchema>) {
  const where = { veiculoId: dados.veiculoId, inicioPrevisto: { not: null } };
  const [programacoes, total] = await prisma.$transaction([
    prisma.manutencao.findMany({
      where,
      include: { fornecedor: { select: { razaoSocial: true } } },
      orderBy: [{ inicioPrevisto: "desc" }, { id: "desc" }],
      skip: (dados.page - 1) * dados.pageSize,
      take: dados.pageSize,
    }),
    prisma.manutencao.count({ where }),
  ]);
  const historico = await historicoProgramacoes(programacoes.map(({ id }) => id));
  return {
    data: programacoes.map((item) => ({ ...item, historico: historico.get(item.id) ?? [] })),
    meta: { page: dados.page, totalPages: Math.ceil(total / dados.pageSize), total },
  };
}

export async function salvarProgramacao(
  dados: ProgramacaoInput,
  usuarioId: string,
  existente?: { id: string; versao: number },
) {
  return transacionarManutencao(async (tx) => {
    await bloquearVeiculo(tx, dados.veiculoId);
    const anterior = existente
      ? await tx.manutencao.findUnique({ where: { id: existente.id } })
      : null;
    if (existente && !anterior) throw new HttpError(404, "Programação não encontrada.");
    if (
      anterior &&
      (anterior.veiculoId !== dados.veiculoId ||
        anterior.status !== "PROGRAMADA" ||
        anterior.versao !== existente?.versao)
    ) {
      throw new HttpError(
        409,
        "A programação foi alterada. Atualize o histórico antes de tentar novamente.",
      );
    }
    const veiculo = await tx.veiculo.findUnique({
      where: { id: dados.veiculoId },
      select: { ativo: true },
    });
    if (!veiculo?.ativo) throw new HttpError(422, "Informe um veículo ativo.");
    if (dados.fornecedorId) {
      const oficina = await tx.fornecedor.findUnique({
        where: { id: dados.fornecedorId },
        select: { ativo: true, tipoServico: true },
      });
      if (!oficina?.ativo || oficina.tipoServico !== "OFICINA")
        throw new HttpError(422, "Selecione uma oficina ativa.");
    }
    const conflitos = await conflitosProgramacao({ ...dados, ignorarId: existente?.id }, tx);
    if (conflitos.viagens.length || conflitos.manutencoes.length) {
      throw new HttpError(409, "A janela conflita com reservas existentes.", [
        ...conflitos.viagens.map((viagem) => ({
          campo: "periodo",
          mensagem: `Viagem ${viagem.protocolo} (${viagem.status}) ocupa o período informado.`,
        })),
        ...conflitos.manutencoes.map(() => ({
          campo: "periodo",
          mensagem: "Há outra manutenção preventiva programada no período.",
        })),
      ]);
    }
    const atual = existente
      ? await tx.manutencao.update({
          where: { id: existente.id },
          data: { ...dados, versao: { increment: 1 } },
        })
      : await tx.manutencao.create({
          data: { ...dados, tipo: "PREVENTIVA", status: "PROGRAMADA" },
        });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: existente ? "REAGENDAR" : "PROGRAMAR",
        tabelaAfetada: "manutencoes",
        registroId: atual.id,
        dadosNovos: JSON.parse(JSON.stringify({ anterior, atual })),
      },
    });
    return atual;
  });
}

export async function cancelarProgramacao(id: string, versao: number, usuarioId: string) {
  const referencia = await prisma.manutencao.findUnique({
    where: { id },
    select: { veiculoId: true },
  });
  if (!referencia) throw new HttpError(404, "Programação não encontrada.");
  return transacionarManutencao(async (tx) => {
    await bloquearVeiculo(tx, referencia.veiculoId);
    const anterior = await tx.manutencao.findUnique({ where: { id } });
    if (!anterior || anterior.status !== "PROGRAMADA" || anterior.versao !== versao)
      throw new HttpError(
        409,
        "A programação foi alterada. Atualize o histórico antes de tentar novamente.",
      );
    const atual = await tx.manutencao.update({
      where: { id },
      data: { status: "CANCELADA", versao: { increment: 1 } },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "CANCELAR",
        tabelaAfetada: "manutencoes",
        registroId: id,
        dadosNovos: JSON.parse(JSON.stringify({ anterior, atual })),
      },
    });
    return atual;
  });
}
