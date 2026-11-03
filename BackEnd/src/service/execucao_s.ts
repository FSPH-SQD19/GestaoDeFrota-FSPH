import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";

const kmSchema = z.number().min(0).max(99999999.99).multipleOf(0.01);
const fotoSchema = z
  .string()
  .trim()
  .max(160_000)
  .regex(
    /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/i,
    "Não foi possível usar a foto. Selecione outra imagem e tente novamente.",
  )
  .refine(
    (foto) => (foto.length - foto.indexOf(",") - 1) % 4 === 0,
    "Não foi possível usar a foto. Selecione outra imagem e tente novamente.",
  );

const itensSaidaSchema = z.object({
  pneus: z.boolean(),
  documentos: z.boolean(),
  combustivel: z.boolean(),
  freiosLuzes: z.boolean(),
  limpeza: z.boolean(),
});

const itensRetornoSchema = z.object({
  pneusLataria: z.boolean(),
  estacionadoLocalCorreto: z.boolean(),
  documentosChaveDevolvidos: z.boolean(),
  limpezaInterna: z.boolean(),
});

export const iniciarViagemSchema = z.object({
  kmInicial: kmSchema,
  checklistSaida: itensSaidaSchema
    .extend({
      fotoOdometro: fotoSchema,
      observacoes: z.string().trim().max(300).optional(),
      fotoAvaria: fotoSchema.optional(),
    })
    .refine(
      (dados) =>
        Object.keys(itensSaidaSchema.shape).every(
          (chave) => dados[chave as keyof typeof itensSaidaSchema.shape],
        ) || (dados.observacoes?.length ?? 0) >= 5,
      { path: ["observacoes"], message: "Descreva o problema identificado (mín. 5 caracteres)." },
    ),
});

export const concluirViagemSchema = z.object({
  kmFinal: kmSchema,
  checklistRetorno: itensRetornoSchema
    .extend({
      fotoOdometro: fotoSchema,
      semOcorrencias: z.boolean(),
      ocorrencias: z.string().trim().max(500).optional(),
      fotoAvaria: fotoSchema.optional(),
    })
    .refine(
      (dados) =>
        (dados.semOcorrencias &&
          Object.keys(itensRetornoSchema.shape).every(
            (chave) => dados[chave as keyof typeof itensRetornoSchema.shape],
          )) ||
        (dados.ocorrencias?.length ?? 0) >= 5,
      { path: ["ocorrencias"], message: "Descreva a ocorrência (mín. 5 caracteres)." },
    ),
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
    throw new HttpError(
      400,
      "Não foi possível identificar a solicitação. Atualize a lista e tente novamente.",
    );
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
      throw new HttpError(
        409,
        "Esta ação não está disponível na situação atual da viagem. Atualize a lista e tente novamente.",
      );
    }
    const veiculoId = viagem.veiculoAlocadoId;
    if (!veiculoId) {
      throw new HttpError(409, "Viagem sem veículo alocado.");
    }

    const motoristaId = viagem.motoristaAlocado.id;
    await tx.$queryRaw`SELECT id FROM motoristas WHERE id = ${motoristaId}::uuid FOR UPDATE`;
    const motorista = await tx.motorista.findUniqueOrThrow({ where: { id: motoristaId } });
    if (!motorista.ativo || motorista.usuarioId !== usuarioId) {
      throw new HttpError(403, "Somente o motorista alocado pode executar esta viagem.");
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
      if (motorista.status !== "DISPONIVEL") {
        throw new HttpError(409, "Motorista indisponível.");
      }

      await tx.motorista.update({
        where: { id: motoristaId },
        data: { status: "OCUPADO" },
      });
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
        data: {
          odometroAtual: dados.kmFinal,
          ...(veiculo.status === "EM_VIAGEM" ? { status: "DISPONIVEL" } : {}),
        },
      });
    }
    if (!iniciar && motorista.status === "OCUPADO") {
      await tx.motorista.update({
        where: { id: motoristaId },
        data: { status: "DISPONIVEL" },
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
        dadosNovos: {
          status,
          ...(iniciar ? { kmInicial: dados.kmInicial } : { kmFinal: dados.kmFinal }),
        },
      },
    });
    return { ...execucao, status };
  });
}
