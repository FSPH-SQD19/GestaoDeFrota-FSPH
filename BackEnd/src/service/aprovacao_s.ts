import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { exigirDocumentosEmDia } from "./documento_veiculo_s";
import { notificarSolicitacaoAprovada, notificarSolicitacaoRecusada } from "./notificacao_s";

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

export async function aprovarSolicitacao(id: string, dados: AprovarInput, usuarioId: string) {
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

        const aprovadaTx = await tx.solicitacaoViagem.findUniqueOrThrow({
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
              protocolo: aprovadaTx.protocolo,
              veiculoAlocadoId: veiculoId,
              motoristaAlocadoId: motoristaId,
              dataHoraPretendida: inicio.toISOString(),
              dataHoraRetornoPrevista: fim.toISOString(),
            },
          },
        });

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

    if (aprovada.solicitanteId) {
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

export const reagendarViagemSchema = z.object({
  novoDataInicio: z.string().datetime().optional(),
  novoDataFim: z.string().datetime().optional(),
  veiculoId: z.uuid().optional(),
  motoristaId: z.uuid().optional(),
  motivo: z.string().trim().min(5, "O motivo da alteração é obrigatório.").max(2000),
});

type ReagendarInput = z.infer<typeof reagendarViagemSchema>;

export async function reagendarViagemAprovada(id: string, dados: ReagendarInput, usuarioId: string) {
  validarId(id);

  let contextoNotificacao = null as {
  solicitanteId: string;
  protocolo: string;
  destino: string | null;
  veiculoPlaca: string | null;
  motoristaUsuarioId: string | null;
} | null;

  try {
    const viagemReagendada = await prisma.$transaction(
      async (tx) => {
        // Impede processamento simultâneo da mesma solicitação
        await tx.$queryRaw`
          SELECT id
          FROM solicitacoes_viagem
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const solicitacao = await tx.solicitacaoViagem.findUnique({
          where: { id },
          include: {
            veiculoAlocado: true,
            motoristaAlocado: true,
          },
        });

        if (!solicitacao) {
          throw new HttpError(404, "Solicitação de viagem não encontrada.");
        }

        if (solicitacao.status !== "APROVADA") {
          throw new HttpError(422, "Apenas viagens com status APROVADA podem ser reagendadas.");
        }

        const agora = new Date();
        const inicioAtual = solicitacao.dataHoraPretendida;

        if (inicioAtual && agora >= inicioAtual) {
          throw new HttpError(422, "Não é possível reagendar uma viagem que já teve seu início alcançado.");
        }

        const novoInicio = dados.novoDataInicio ? new Date(dados.novoDataInicio) : solicitacao.dataHoraPretendida;
        const novoFim = dados.novoDataFim ? new Date(dados.novoDataFim) : solicitacao.dataHoraRetornoPrevista;
        const novoVeiculoId = dados.veiculoId ?? solicitacao.veiculoAlocadoId;
        const novoMotoristaId = dados.motoristaId ?? solicitacao.motoristaAlocadoId;

        if (!novoInicio || !novoFim || novoInicio >= novoFim) {
          throw new HttpError(422, "O intervalo da viagem (saída e retorno) é inválido.");
        }

        if (!novoVeiculoId || !novoMotoristaId) {
          throw new HttpError(422, "Veículo e motorista devem estar definidos para a viagem.");
        }

        // Travar recursos em ordem fixa para evitar deadlock
        const recursos = [`motorista:${novoMotoristaId}`, `veiculo:${novoVeiculoId}`].sort();
        for (const recurso of recursos) {
          await tx.$queryRaw`
            SELECT 1 AS locked FROM pg_advisory_xact_lock(
              hashtextextended(${recurso}, 0)
            )
          `;
        }

        // Validar Veículo
        const veiculo = await tx.veiculo.findUnique({
          where: { id: novoVeiculoId },
        });

        if (
          !veiculo ||
          !veiculo.ativo ||
          veiculo.tipoFrota !== "ADMINISTRATIVA" ||
          veiculo.status !== "DISPONIVEL"
        ) {
          throw new HttpError(422, "O veículo selecionado está indisponível ou inativo.");
        }

        if (veiculo.capacidadeMaxima < solicitacao.quantidadePassageiros) {
          throw new HttpError(422, "Capacidade do veículo insuficiente para a quantidade de passageiros.");
        }

        await exigirDocumentosEmDia(tx, novoVeiculoId, dataLocal(novoFim));

        // Validar Motorista
        const motorista = await tx.motorista.findUnique({
          where: { id: novoMotoristaId },
        });

        if (!motorista || !motorista.ativo || motorista.status !== "DISPONIVEL") {
          throw new HttpError(422, "O motorista selecionado está indisponível ou inativo.");
        }

        const validadeCnh = motorista.validadeCnh.toISOString().slice(0, 10);
        if (validadeCnh < dataLocal(novoFim)) {
          throw new HttpError(422, "A CNH do motorista selecionado estará vencida durante o período da viagem.");
        }

        // Checar conflitos de agenda (excluindo a própria viagem)
        const conflito = await tx.solicitacaoViagem.findFirst({
          where: {
            id: { not: id },
            status: {
              in: ["APROVADA", "EM_TRANSITO"],
            },
            dataHoraPretendida: { lt: novoFim },
            dataHoraRetornoPrevista: { gt: novoInicio },
            OR: [{ veiculoAlocadoId: novoVeiculoId }, { motoristaAlocadoId: novoMotoristaId }],
          },
          select: { id: true },
        });

        if (conflito) {
          throw new HttpError(409, "O veículo ou o motorista já possui outra viagem alocada neste horário.");
        }

        const dadosAntigosSnapshot = {
          dataHoraPretendida: solicitacao.dataHoraPretendida?.toISOString(),
          dataHoraRetornoPrevista: solicitacao.dataHoraRetornoPrevista?.toISOString(),
          veiculoAlocadoId: solicitacao.veiculoAlocadoId,
          motoristaAlocadoId: solicitacao.motoristaAlocadoId,
        };

        const viagemAtualizada = await tx.solicitacaoViagem.update({
          where: { id },
          data: {
            dataHoraPretendida: novoInicio,
            dataHoraRetornoPrevista: novoFim,
            veiculoAlocadoId: novoVeiculoId,
            motoristaAlocadoId: novoMotoristaId,
          },
        });

        const dadosNovosSnapshot = {
          dataHoraPretendida: novoInicio.toISOString(),
          dataHoraRetornoPrevista: novoFim.toISOString(),
          veiculoAlocadoId: novoVeiculoId,
          motoristaAlocadoId: novoMotoristaId,
          motivoAlteracao: dados.motivo,
        };

        // Auditoria padronizada
        await tx.auditoriaSistema.create({
          data: {
            usuarioId,
            acao: "REAGENDAR_VIAGEM",
            tabelaAfetada: "solicitacoes_viagem",
            registroId: id,
            dadosNovos: {
              protocolo: solicitacao.protocolo,
              dadosAntigos: dadosAntigosSnapshot,
              dadosNovos: dadosNovosSnapshot,
              motivo: dados.motivo,
            },
          },
        });

        contextoNotificacao = {
          solicitanteId: solicitacao.solicitanteId!,
          protocolo: solicitacao.protocolo,
          destino: solicitacao.destino ?? null,
          veiculoPlaca: veiculo.placa ?? null,
          motoristaUsuarioId: motorista.usuarioId ?? null,
        };

        return viagemAtualizada;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    if (contextoNotificacao && contextoNotificacao.solicitanteId) {
      await notificarSolicitacaoAprovada({
        id: viagemReagendada.id,
        protocolo: contextoNotificacao.protocolo,
        destino: contextoNotificacao.destino,
        solicitanteId: contextoNotificacao.solicitanteId,
        veiculoPlaca: contextoNotificacao.veiculoPlaca,
        motoristaUsuarioId: contextoNotificacao.motoristaUsuarioId,
      });
    }

    return viagemReagendada;
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2028"].includes(erro.code)
    ) {
      throw new HttpError(
        409,
        "Os dados foram alterados por outra pessoa durante a operação. Atualize a página e tente novamente.",
      );
    }
    throw erro;
  }
}