import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";
import { exigirDocumentosEmDia } from "./documento_veiculo_s";

export const aprovarSolicitacaoSchema = z.object({
  veiculoId: z.uuid(),
  motoristaId: z.uuid(),
});

export const recusarSolicitacaoSchema = z.object({
  motivoRecusa: z.string().trim().min(1).max(2000),
});

type AprovarInput = z.infer<typeof aprovarSolicitacaoSchema>;
type RecusarInput = z.infer<typeof recusarSolicitacaoSchema>;

function validarId(id: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "ID da solicitação inválido.");
  }
}

function dataLocal(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value;

  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export async function aprovarSolicitacao(id: string, dados: AprovarInput, usuarioId: string) {
  validarId(id);

  const { veiculoId, motoristaId } = dados;

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Trava os recursos em ordem fixa.
        const recursos = [`motorista:${motoristaId}`, `veiculo:${veiculoId}`].sort();

        for (const recurso of recursos) {
          await tx.$queryRaw`
            SELECT 1 AS locked FROM pg_advisory_xact_lock(
              hashtextextended(${recurso}, 0)
            )
          `;
        }

        // Impede processamento simultâneo da mesma solicitação.
        await tx.$queryRaw`
          SELECT id
          FROM solicitacoes_viagem
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const solicitacao = await tx.solicitacaoViagem.findUnique({
          where: { id },
        });

        if (!solicitacao) {
          throw new HttpError(404, "Solicitação não encontrada.");
        }

        if (solicitacao.status !== "PENDENTE") {
          throw new HttpError(409, "Solicitação já processada.");
        }

        const inicio = solicitacao.dataHoraPretendida;
        const fim = solicitacao.dataHoraRetornoPrevista;

        if (!inicio || !fim || inicio >= fim) {
          throw new HttpError(422, "A solicitação precisa ter saída e retorno válidos.");
        }

        const veiculo = await tx.veiculo.findUnique({
          where: { id: veiculoId },
        });

        if (
          !veiculo ||
          !veiculo.ativo ||
          veiculo.tipoFrota !== "ADMINISTRATIVA" ||
          veiculo.status !== "DISPONIVEL"
        ) {
          throw new HttpError(422, "Veículo administrativo indisponível.");
        }

        if (veiculo.capacidadeMaxima < solicitacao.quantidadePassageiros) {
          throw new HttpError(422, "Capacidade do veículo insuficiente para os passageiros.");
        }

        await exigirDocumentosEmDia(tx, veiculoId, dataLocal(fim));

        const motorista = await tx.motorista.findUnique({
          where: { id: motoristaId },
        });

        if (!motorista || !motorista.ativo || motorista.status !== "DISPONIVEL") {
          throw new HttpError(422, "Motorista não encontrado, inativo ou indisponível.");
        }

        const validadeCnh = motorista.validadeCnh.toISOString().slice(0, 10);

        if (validadeCnh < dataLocal(fim)) {
          throw new HttpError(422, "CNH vencida durante o período da viagem.");
        }

        // Dois intervalos conflitam quando:
        // inicioExistente < fimNovo
        // e fimExistente > inicioNovo
        const conflito = await tx.solicitacaoViagem.findFirst({
          where: {
            id: { not: id },
            status: {
              in: ["APROVADA", "EM_TRANSITO"],
            },
            dataHoraPretendida: { lt: fim },
            dataHoraRetornoPrevista: { gt: inicio },
            OR: [{ veiculoAlocadoId: veiculoId }, { motoristaAlocadoId: motoristaId }],
          },
          select: { id: true },
        });

        if (conflito) {
          throw new HttpError(409, "Veículo ou motorista já possui viagem neste horário.");
        }

        const alteracao = await tx.solicitacaoViagem.updateMany({
          where: {
            id,
            status: "PENDENTE",
          },
          data: {
            status: "APROVADA",
            veiculoAlocadoId: veiculoId,
            motoristaAlocadoId: motoristaId,
            motivoRecusa: null,
          },
        });

        if (alteracao.count !== 1) {
          throw new HttpError(409, "Solicitação já processada.");
        }

        const aprovada = await tx.solicitacaoViagem.findUniqueOrThrow({
          where: { id },
        });

        await tx.auditoriaSistema.create({
          data: {
            usuarioId,
            acao: "APROVAR",
            tabelaAfetada: "solicitacoes_viagem",
            registroId: id,
            dadosNovos: {
              status: "APROVADA",
              protocolo: aprovada.protocolo,
              veiculoAlocadoId: veiculoId,
              motoristaAlocadoId: motoristaId,
              dataHoraPretendida: inicio.toISOString(),
              dataHoraRetornoPrevista: fim.toISOString(),
            },
          },
        });

        return aprovada;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2028"].includes(erro.code)
    ) {
      throw new HttpError(409, "Conflito de concorrência. Tente novamente.");
    }

    throw erro;
  }
}

export async function recusarSolicitacao(id: string, dados: RecusarInput, usuarioId: string) {
  validarId(id);

  return prisma.$transaction(async (tx) => {
    const alteracao = await tx.solicitacaoViagem.updateMany({
      where: {
        id,
        status: "PENDENTE",
      },
      data: {
        status: "RECUSADA",
        motivoRecusa: dados.motivoRecusa,
      },
    });

    if (alteracao.count !== 1) {
      const existente = await tx.solicitacaoViagem.findUnique({
        where: { id },
        select: { id: true },
      });

      throw new HttpError(
        existente ? 409 : 404,
        existente ? "Solicitação já processada." : "Solicitação não encontrada.",
      );
    }

    const recusada = await tx.solicitacaoViagem.findUniqueOrThrow({
      where: { id },
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "RECUSAR",
        tabelaAfetada: "solicitacoes_viagem",
        registroId: id,
        dadosNovos: {
          protocolo: recusada.protocolo,
          status: "RECUSADA",
          motivoRecusa: dados.motivoRecusa,
        },
      },
    });

    return recusada;
  });
}
