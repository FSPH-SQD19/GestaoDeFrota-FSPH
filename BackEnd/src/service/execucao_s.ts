import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";

const kmSchema = z.number().min(0).max(99999999.99).multipleOf(0.01);
const checklistSchema = z.record(z.string(), z.json());

export const iniciarViagemSchema = z.object({
  kmInicial: kmSchema,
  checklistSaida: checklistSchema,
});

export const concluirViagemSchema = z.object({
  kmFinal: kmSchema,
  checklistRetorno: checklistSchema,
});

type IniciarViagemInput = z.infer<typeof iniciarViagemSchema>;
type ConcluirViagemInput = z.infer<typeof concluirViagemSchema>;

export async function iniciarViagem(id: string, dados: IniciarViagemInput, usuarioId: string) {
  return executarViagem(id, usuarioId, dados);
}

export async function concluirViagem(id: string, dados: ConcluirViagemInput, usuarioId: string) {
  return executarViagem(id, usuarioId, dados);
}

export async function executarViagem(
  id: string,
  usuarioId: string,
  dados: IniciarViagemInput | ConcluirViagemInput,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "ID da solicitação inválido.");
  }
  const iniciar = "kmInicial" in dados;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM solicitacoes_viagem WHERE id = ${id}::uuid FOR UPDATE`;
    const viagem = await tx.solicitacaoViagem.findUnique({
      where: { id },
      include: { motoristaAlocado: true, execucao: true },
    });
    if (!viagem) {
      throw new HttpError(404, "Solicitação não encontrada.");
    }

    if (!viagem.motoristaAlocado?.ativo || viagem.motoristaAlocado.usuarioId !== usuarioId) {
      throw new HttpError(403, "Somente o motorista alocado pode executar esta viagem.");
    }
    if (viagem.status !== (iniciar ? "APROVADA" : "EM_TRANSITO")) {
      throw new HttpError(409, "Status da solicitação incompatível com a operação.");
    }
    const veiculoId = viagem.veiculoAlocadoId;
    if (!veiculoId) {
      throw new HttpError(409, "Viagem sem veículo alocado.");
    }

    await tx.$queryRaw`SELECT id FROM veiculos WHERE id = ${veiculoId}::uuid FOR UPDATE`;
    const veiculo = await tx.veiculo.findUniqueOrThrow({ where: { id: veiculoId } });
    let execucao;

    if ("kmInicial" in dados) {
      if (viagem.execucao || !veiculo.ativo || veiculo.status !== "DISPONIVEL") {
        throw new HttpError(409, "Viagem já iniciada ou veículo indisponível.");
      }
      if (new Prisma.Decimal(dados.kmInicial).lessThan(veiculo.odometroAtual)) {
        throw new HttpError(422, "Km inicial não pode ser menor que o odômetro atual.");
      }
      execucao = await tx.execucaoViagem.create({
        data: { solicitacaoId: id, ...dados, dataHoraInicio: new Date() },
      });
      await tx.veiculo.update({
        where: { id: veiculoId },
        data: { status: "EM_VIAGEM" },
      });
    } else {
      if (!viagem.execucao || viagem.execucao.kmInicial === null || viagem.execucao.dataHoraFim) {
        throw new HttpError(409, "Execução não iniciada ou já concluída.");
      }
      if (new Prisma.Decimal(dados.kmFinal).lessThan(viagem.execucao.kmInicial)) {
        throw new HttpError(422, "Km final deve ser maior ou igual ao km inicial.");
      }
      if (new Prisma.Decimal(dados.kmFinal).lessThan(veiculo.odometroAtual)) {
        throw new HttpError(422, "Km final não pode ser menor que o odômetro atual.");
      }
      execucao = await tx.execucaoViagem.update({
        where: { solicitacaoId: id },
        data: { ...dados, dataHoraFim: new Date() },
      });
      await tx.veiculo.update({
        where: { id: veiculoId },
        data: { odometroAtual: dados.kmFinal, status: "DISPONIVEL" },
      });
    }
    const status = iniciar ? "EM_TRANSITO" : "CONCLUIDA";
    await tx.solicitacaoViagem.update({
      where: { id },
      data: { status },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: iniciar ? "INICIAR" : "CONCLUIR",
        tabelaAfetada: "solicitacoes_viagem",
        registroId: id,
        dadosNovos: { status, ...dados },
      },
    });
    return { ...execucao, status };
  });
}
