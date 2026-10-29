import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";

export const criarChamadoSchema = z
  .object({
    nomeFalecido: z.string().trim().min(2).max(150),
    enderecoOcorrencia: z.string().trim().min(3),
    relatoOcorrencia: z.string().trim().min(3),
  })
  .strict();

export const triagemSchema = z
  .object({
    decisao: z.enum(["APROVAR", "RECUSAR"]),
    justificativa: z.string().trim().min(3).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decisao === "RECUSAR" && !value.justificativa) {
      ctx.addIssue({
        code: "custom",
        path: ["justificativa"],
        message: "Justificativa obrigatória para recusa.",
      });
    }
  });

export const emitirOrdemSchema = z
  .object({
    veiculoId: z.uuid(),
    motoristaId: z.uuid(),
    numeroDeclaracaoObito: z.string().trim().max(50).optional(),
  })
  .strict();

export const listarChamadosSchema = z.object({
  status: z.enum(["EM_ANALISE", "APROVADO", "RECUSADO"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function indicadoresSvo() {
  const [total, emAnalise, aprovados, recusados, coletasEmAndamento, viaturasDisponiveis] =
    await Promise.all([
      prisma.chamadoSvo.count(),
      prisma.chamadoSvo.count({ where: { statusTriagem: "EM_ANALISE" } }),
      prisma.chamadoSvo.count({ where: { statusTriagem: "APROVADO" } }),
      prisma.chamadoSvo.count({ where: { statusTriagem: "RECUSADO" } }),
      prisma.ordemColetaSvo.count({ where: { status: "EM_ANDAMENTO" } }),
      prisma.veiculo.count({ where: { tipoFrota: "SVO", ativo: true, status: "DISPONIVEL" } }),
    ]);
  return { total, emAnalise, aprovados, recusados, coletasEmAndamento, viaturasDisponiveis };
}

export async function listarChamadosSvo(filtros: z.infer<typeof listarChamadosSchema>) {
  const where: Prisma.ChamadoSvoWhereInput = filtros.status
    ? { statusTriagem: filtros.status }
    : {};
  const [data, total] = await Promise.all([
    prisma.chamadoSvo.findMany({
      where,
      include: {
        ordemColeta: {
          include: {
            veiculo: true,
            motorista: { include: { usuario: { select: { nome: true } } } },
          },
        },
      },
      orderBy: { id: "desc" },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.chamadoSvo.count({ where }),
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

export async function registrarChamadoSvo(
  input: z.infer<typeof criarChamadoSchema>,
  atendenteId: string,
) {
  // Protocolo único baseado no UUID; não depende da quantidade de registros.
  return prisma.$transaction(async (tx) => {
    const chamado = await tx.chamadoSvo.create({ data: { ...input, atendenteId } });
    const numeroProtocolo = `SVO-${chamado.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    return tx.chamadoSvo.update({ where: { id: chamado.id }, data: { numeroProtocolo } });
  });
}

export async function realizarTriagemSvo(id: string, input: z.infer<typeof triagemSchema>) {
  const statusTriagem = input.decisao === "APROVAR" ? "APROVADO" : "RECUSADO";
  // Compare-and-set impede que duas triagens alterem o mesmo chamado.
  const result = await prisma.chamadoSvo.updateMany({
    where: { id, statusTriagem: "EM_ANALISE" },
    data: { statusTriagem },
  });
  if (result.count === 0) {
    const exists = await prisma.chamadoSvo.findUnique({ where: { id }, select: { id: true } });
    throw new HttpError(
      exists ? 409 : 404,
      exists ? "Chamado já triado." : "Chamado não encontrado.",
    );
  }
  // Justificativa ainda não é persistida: falta coluna específica no schema.
  return prisma.chamadoSvo.findUniqueOrThrow({ where: { id } });
}

export async function emitirOrdemColetaSvo(
  chamadoId: string,
  input: z.infer<typeof emitirOrdemSchema>,
) {
  return prisma.$transaction(async (tx) => {
    // Lock transacional no veículo para impedir duas alocações simultâneas.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM veiculos WHERE id = ${input.veiculoId}::uuid FOR UPDATE
    `;
    if (locked.length === 0) throw new HttpError(404, "Viatura não encontrada.");

    const [chamado, veiculo, motorista] = await Promise.all([
      tx.chamadoSvo.findUnique({ where: { id: chamadoId }, include: { ordemColeta: true } }),
      tx.veiculo.findUnique({ where: { id: input.veiculoId } }),
      tx.motorista.findUnique({ where: { id: input.motoristaId } }),
    ]);
    if (!chamado) throw new HttpError(404, "Chamado não encontrado.");
    if (chamado.statusTriagem !== "APROVADO")
      throw new HttpError(409, "Chamado precisa ser aprovado na triagem.");
    if (chamado.ordemColeta) throw new HttpError(409, "Chamado já possui ordem de coleta.");
    if (
      !veiculo ||
      veiculo.tipoFrota !== "SVO" ||
      !veiculo.ativo ||
      veiculo.status !== "DISPONIVEL"
    ) {
      throw new HttpError(422, "Viatura SVO indisponível ou inválida.");
    }
    if (veiculo.capacidadeMaxima < 1)
      throw new HttpError(422, "Viatura sem capacidade operacional.");
    if (!motorista || !motorista.ativo || motorista.status !== "DISPONIVEL") {
      throw new HttpError(422, "Motorista indisponível ou inválido.");
    }
    const hoje = new Date();
    const dataHojeUTC = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
    );
    if (motorista.validadeCnh < dataHojeUTC) throw new HttpError(422, "CNH do motorista vencida.");
    const ordem = await tx.ordemColetaSvo.create({
      data: {
        chamadoId,
        veiculoId: veiculo.id,
        motoristaId: motorista.id,
        numeroDeclaracaoObito: input.numeroDeclaracaoObito,
        status: "AGUARDANDO_DESPACHO",
      },
    });
    await tx.veiculo.update({ where: { id: veiculo.id }, data: { status: "EM_VIAGEM" } });
    await tx.motorista.update({ where: { id: motorista.id }, data: { status: "OCUPADO" } });
    return ordem;
  });
}

export async function listarViaturasSvo() {
  return prisma.veiculo.findMany({
    where: { tipoFrota: "SVO", ativo: true },
    select: {
      id: true,
      placa: true,
      modelo: true,
      status: true,
      capacidadeMaxima: true,
      ativo: true,
    },
    orderBy: { placa: "asc" },
  });
}

export async function listarMotoristasSvoDisponiveis() {
  const hoje = new Date();
  const dataHojeUTC = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  return prisma.motorista.findMany({
    where: { ativo: true, status: "DISPONIVEL", validadeCnh: { gte: dataHojeUTC } },
    select: { id: true, numeroCnh: true, categoriaCnh: true, usuario: { select: { nome: true } } },
    orderBy: { cpf: "asc" },
  });
}
