import { Prisma } from "@prisma/client";
import { exigirSemReservaPreventiva } from "./programacao_manutencao_s";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { exigirDocumentosEmDia } from "./documento_veiculo_s";
import {
  invalidarCacheSincronizacaoNotificacoes,
  notificarSolicitacaoAprovada,
  notificarSolicitacaoRecusada,
} from "./notificacao_s";

export const aprovarSolicitacaoSchema = z.object({
  veiculoId: z.uuid(),
  motoristaId: z.uuid(),
  dataHoraRetornoPrevista: z.iso
    .datetime({ offset: true })
    .transform((valor) => new Date(valor))
    .optional(),
});

export const recusarSolicitacaoSchema = z.object({
  motivoRecusa: z.string().trim().min(1).max(2000),
});

type AprovarInput = z.infer<typeof aprovarSolicitacaoSchema>;
type RecusarInput = z.infer<typeof recusarSolicitacaoSchema>;

function validarId(id: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(
      400,
      "Não foi possível identificar a solicitação. Atualize a lista e tente novamente.",
    );
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

export const reagendarSolicitacaoSchema = aprovarSolicitacaoSchema
  .safeExtend({
    inicio: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
    fim: z.iso.datetime({ offset: true }).transform((valor) => new Date(valor)),
    motivo: z.string().trim().min(5, "Informe o motivo da alteração.").max(2000),
  })
  .refine((dados) => dados.inicio < dados.fim, {
    path: ["fim"],
    message: "O retorno deve ser posterior à saída.",
  });

export function aprovarSolicitacao(id: string, dados: AprovarInput, usuarioId: string) {
  return salvarAlocacao(id, dados, usuarioId);
}

export function reagendarSolicitacao(
  id: string,
  dados: z.infer<typeof reagendarSolicitacaoSchema>,
  usuarioId: string,
) {
  return salvarAlocacao(id, dados, usuarioId, {
    inicio: dados.inicio,
    fim: dados.fim,
    motivo: dados.motivo,
  });
}

async function salvarAlocacao(
  id: string,
  dados: AprovarInput,
  usuarioId: string,
  janela?: { inicio: Date; fim: Date; motivo: string },
) {
  validarId(id);

  const { veiculoId, motoristaId } = dados;
  let contextoNotificacao: {
    veiculoPlaca: string | null;
    motoristaUsuarioId: string | null;
  } | null = null;

  try {
    const aprovada = await prisma.$transaction(
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

        if (solicitacao.status !== (janela ? "APROVADA" : "PENDENTE")) {
          throw new HttpError(409, "Solicitação já processada.");
        }

        if (
          !solicitacao.dataHoraPretendida ||
          solicitacao.dataHoraPretendida.getTime() <= Date.now()
        ) {
          throw new HttpError(422, "A aprovação exige uma saída futura.");
        }
        if (janela && janela.inicio.getTime() <= Date.now()) {
          throw new HttpError(422, "O reagendamento exige uma nova saída futura.");
        }
        const inicio = janela?.inicio ?? solicitacao.dataHoraPretendida;
        const fim =
          janela?.fim ?? solicitacao.dataHoraRetornoPrevista ?? dados.dataHoraRetornoPrevista;

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

        await exigirSemReservaPreventiva(tx, veiculoId, inicio, fim);

        const alteracao = await tx.solicitacaoViagem.updateMany({
          where: {
            id,
            status: janela ? "APROVADA" : "PENDENTE",
          },
          data: {
            status: "APROVADA",
            veiculoAlocadoId: veiculoId,
            motoristaAlocadoId: motoristaId,
            motivoRecusa: null,
            ...(janela ? { dataHoraPretendida: inicio } : {}),
            ...(janela || !solicitacao.dataHoraRetornoPrevista
              ? { dataHoraRetornoPrevista: fim }
              : {}),
          },
        });

        if (alteracao.count !== 1) {
          throw new HttpError(409, "Solicitação já processada.");
        }

        const aprovadaTx = await tx.solicitacaoViagem.findUniqueOrThrow({
          where: { id },
        });

        await tx.auditoriaSistema.create({
          data: {
            usuarioId,
            acao: janela ? "REAGENDAR" : "APROVAR",
            tabelaAfetada: "solicitacoes_viagem",
            registroId: id,
            dadosNovos: {
              status: "APROVADA",
              protocolo: aprovadaTx.protocolo,
              veiculoAlocadoId: veiculoId,
              motoristaAlocadoId: motoristaId,
              dataHoraPretendida: inicio.toISOString(),
              dataHoraRetornoPrevista: fim.toISOString(),
              ...(janela
                ? {
                    motivo: janela.motivo,
                    anterior: {
                      veiculoAlocadoId: solicitacao.veiculoAlocadoId,
                      motoristaAlocadoId: solicitacao.motoristaAlocadoId,
                      dataHoraPretendida: solicitacao.dataHoraPretendida?.toISOString() ?? null,
                      dataHoraRetornoPrevista:
                        solicitacao.dataHoraRetornoPrevista?.toISOString() ?? null,
                    },
                  }
                : {}),
            },
          },
        });

        if (janela) {
          const motoristaAnterior =
            solicitacao.motoristaAlocadoId && solicitacao.motoristaAlocadoId !== motoristaId
              ? await tx.motorista.findUnique({
                  where: { id: solicitacao.motoristaAlocadoId },
                  select: { usuarioId: true },
                })
              : null;
          const destinatarios = new Set(
            [solicitacao.solicitanteId, motorista.usuarioId, motoristaAnterior?.usuarioId].filter(
              (destinatario): destinatario is string => Boolean(destinatario),
            ),
          );
          if (destinatarios.size) {
            await tx.notificacao.createMany({
              data: [...destinatarios].map((destinatario) => ({
                usuarioId: destinatario,
                tipo: "VIAGEM_REAGENDADA",
                titulo: `Viagem ${solicitacao.protocolo} reagendada`,
                mensagem:
                  destinatario === motoristaAnterior?.usuarioId &&
                  destinatario !== motorista.usuarioId
                    ? `Você não está mais alocado à viagem ${solicitacao.protocolo}.`
                    : `A programação da viagem ${solicitacao.protocolo} foi alterada. Consulte os detalhes.`,
                referenciaTipo: "SOLICITACAO_VIAGEM",
                referenciaId: id,
              })),
            });
          }
        }

        contextoNotificacao = {
          veiculoPlaca: veiculo.placa ?? null,
          motoristaUsuarioId: motorista.usuarioId ?? null,
        };

        return aprovadaTx;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    if (janela) invalidarCacheSincronizacaoNotificacoes();
    if (aprovada.solicitanteId && !janela) {
      const ctx = contextoNotificacao as {
        veiculoPlaca: string | null;
        motoristaUsuarioId: string | null;
      } | null;
      await notificarSolicitacaoAprovada({
        id: aprovada.id,
        protocolo: aprovada.protocolo,
        destino: aprovada.destino ?? null,
        solicitanteId: aprovada.solicitanteId,
        veiculoPlaca: ctx?.veiculoPlaca ?? null,
        motoristaUsuarioId: ctx?.motoristaUsuarioId ?? null,
      });
    }

    return aprovada;
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2028"].includes(erro.code)
    ) {
      throw new HttpError(
        409,
        "Os dados foram alterados por outra pessoa. Atualize a página e tente novamente.",
      );
    }

    throw erro;
  }
}

export async function recusarSolicitacao(id: string, dados: RecusarInput, usuarioId: string) {
  validarId(id);

  const recusada = await prisma.$transaction(async (tx) => {
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

    const recusadaTx = await tx.solicitacaoViagem.findUniqueOrThrow({
      where: { id },
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "RECUSAR",
        tabelaAfetada: "solicitacoes_viagem",
        registroId: id,
        dadosNovos: {
          protocolo: recusadaTx.protocolo,
          status: "RECUSADA",
          motivoRecusa: dados.motivoRecusa,
        },
      },
    });

    return recusadaTx;
  });

  if (recusada.solicitanteId) {
    await notificarSolicitacaoRecusada({
      id: recusada.id,
      protocolo: recusada.protocolo,
      solicitanteId: recusada.solicitanteId,
      motivoRecusa: dados.motivoRecusa,
    });
  }

  return recusada;
}
