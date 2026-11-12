import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { dataDoBanco, dataLocal } from "./documento_veiculo_s";

// S19FROTA-249 (RF014-SVO / RN-SVO-002): escalas e plantões do SVO.
const SITUACOES_ESCALA = ["AGENDADA", "EM_ANDAMENTO", "SUSPENSA", "ENCERRADA"] as const;
export type SituacaoEscala = (typeof SITUACOES_ESCALA)[number];

const DURACAO_MAXIMA_TURNO_HORAS = 24;
const HORA_MS = 60 * 60 * 1000;

// Validacao
function dataHora(campo: string) {
  return z.iso.datetime({
    offset: true,
    error: `Informe uma data e hora válidas para ${campo.toLocaleLowerCase("pt-BR")}.`,
  });
}

export const criarEscalaSvoSchema = z
  .object({
    motoristaId: z.uuid("Selecione um motorista válido."),
    veiculoId: z.uuid("Selecione uma viatura válida."),
    inicioTurno: dataHora("Início do turno"),
    fimTurno: dataHora("Fim do turno"),
    observacoes: z.preprocess(
      (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
      z
        .string({ error: "Confira as observações informadas." })
        .trim()
        .max(300, "Observações devem ter no máximo 300 caracteres.")
        .nullish()
        .transform((valor) => valor ?? undefined),
    ),
  })
  .superRefine((valor, ctx) => {
    // No Mega Zod 4 o refinamento roda mesmo com campos inválidos: conferir antes de comparar.
    const formato = z.iso.datetime({ offset: true });
    if (!formato.safeParse(valor.inicioTurno).success) return;
    if (!formato.safeParse(valor.fimTurno).success) return;
    const duracao = Date.parse(valor.fimTurno) - Date.parse(valor.inicioTurno);
    if (!(duracao > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["fimTurno"],
        message: "Fim do turno deve ser posterior ao início.",
      });
    } else if (duracao > DURACAO_MAXIMA_TURNO_HORAS * HORA_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["fimTurno"],
        message: `O turno deve ter no máximo ${DURACAO_MAXIMA_TURNO_HORAS} horas.`,
      });
    }
  });

export type CriarEscalaSvoInput = z.infer<typeof criarEscalaSvoSchema>;

export const listarEscalasSvoSchema = z.object({
  situacao: z
    .enum(SITUACOES_ESCALA, {
      error: "Selecione a situação da escala na lista.",
    })
    .optional(),
  motoristaId: z.uuid("Motorista inválido.").optional(),
  veiculoId: z.uuid("Viatura inválida.").optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListarEscalasSvoFiltros = z.infer<typeof listarEscalasSvoSchema>;

// Regras
type Turno = { inicioTurno: Date; fimTurno: Date; encerradaEm: Date | null };

function fimEfetivo(turno: Turno): Date {
  return turno.encerradaEm && turno.encerradaEm < turno.fimTurno
    ? turno.encerradaEm
    : turno.fimTurno;
}

export function calcularSituacaoEscala(
  turno: Turno,
  agora: Date,
  recursosAtivos = true,
): SituacaoEscala {
  if (turno.encerradaEm || turno.fimTurno <= agora) return "ENCERRADA";
  if (!recursosAtivos) return "SUSPENSA";
  if (turno.inicioTurno > agora) return "AGENDADA";
  return "EM_ANDAMENTO";
}

export function turnosSeSobrepoem(existente: Turno, inicio: Date, fim: Date): boolean {
  const fimExistente = fimEfetivo(existente);
  if (fimExistente <= existente.inicioTurno) return false;
  return existente.inicioTurno < fim && fimExistente > inicio;
}

const RECURSOS_ATIVOS = {
  motorista: { ativo: true },
  veiculo: { ativo: true },
} satisfies Prisma.EscalaSvoWhereInput;

function whereSituacao(situacao: SituacaoEscala, agora: Date): Prisma.EscalaSvoWhereInput {
  if (situacao === "AGENDADA") {
    return { encerradaEm: null, inicioTurno: { gt: agora }, ...RECURSOS_ATIVOS };
  }
  if (situacao === "EM_ANDAMENTO") {
    return {
      encerradaEm: null,
      inicioTurno: { lte: agora },
      fimTurno: { gt: agora },
      ...RECURSOS_ATIVOS,
    };
  }
  if (situacao === "SUSPENSA") {
    return {
      encerradaEm: null,
      fimTurno: { gt: agora },
      OR: [{ motorista: { ativo: false } }, { veiculo: { ativo: false } }],
    };
  }
  return { OR: [{ encerradaEm: { not: null } }, { fimTurno: { lte: agora } }] };
}

// Serializacao
const incluirRelacoes = {
  motorista: {
    select: { id: true, telefone: true, ativo: true, usuario: { select: { nome: true } } },
  },
  veiculo: { select: { id: true, placa: true, modelo: true, status: true, ativo: true } },
} satisfies Prisma.EscalaSvoInclude;

type EscalaComRelacoes = Prisma.EscalaSvoGetPayload<{ include: typeof incluirRelacoes }>;

function serializarEscala(escala: EscalaComRelacoes, agora: Date) {
  return {
    id: escala.id,
    motorista: {
      id: escala.motorista.id,
      nome: escala.motorista.usuario?.nome ?? null,
      telefone: escala.motorista.telefone,
      ativo: escala.motorista.ativo,
    },
    veiculo: escala.veiculo,
    inicioTurno: escala.inicioTurno,
    fimTurno: escala.fimTurno,
    observacoes: escala.observacoes,
    encerradaEm: escala.encerradaEm,
    situacao: calcularSituacaoEscala(escala, agora, escala.motorista.ativo && escala.veiculo.ativo),
  };
}

// Servico
async function transacionar<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(operacao, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2028"].includes(error.code)
    ) {
      throw new HttpError(
        409,
        "A escala foi alterada por outra pessoa. Atualize a lista e tente novamente.",
      );
    }
    throw error;
  }
}

export async function listarEscalasSvo(filtros: ListarEscalasSvoFiltros, agora = new Date()) {
  const condicoes: Prisma.EscalaSvoWhereInput[] = [];
  if (filtros.situacao) condicoes.push(whereSituacao(filtros.situacao, agora));
  if (filtros.motoristaId) condicoes.push({ motoristaId: filtros.motoristaId });
  if (filtros.veiculoId) condicoes.push({ veiculoId: filtros.veiculoId });
  const where: Prisma.EscalaSvoWhereInput = condicoes.length ? { AND: condicoes } : {};
  const direcao = filtros.situacao && filtros.situacao !== "ENCERRADA" ? "asc" : "desc";

  const [total, escalas] = await Promise.all([
    prisma.escalaSvo.count({ where }),
    prisma.escalaSvo.findMany({
      where,
      include: incluirRelacoes,
      orderBy: [{ inicioTurno: direcao }, { id: "asc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
  ]);

  return {
    data: escalas.map((escala) => serializarEscala(escala, agora)),
    meta: {
      page: filtros.page,
      pageSize: filtros.pageSize,
      total,
      totalPages: Math.ceil(total / filtros.pageSize),
    },
  };
}

export async function criarEscalaSvo(
  input: CriarEscalaSvoInput,
  usuarioId: string,
  agora = new Date(),
) {
  const inicio = new Date(input.inicioTurno);
  const fim = new Date(input.fimTurno);
  if (fim <= agora) {
    throw new HttpError(422, "Não é possível escalar um turno que já terminou.", [
      { campo: "fimTurno", mensagem: "O fim do turno deve ser futuro." },
    ]);
  }

  return transacionar(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`motorista:${input.motoristaId}`}, 0))`;

    const [motorista, veiculo] = await Promise.all([
      tx.motorista.findUnique({
        where: { id: input.motoristaId },
        select: { id: true, ativo: true, validadeCnh: true },
      }),
      tx.veiculo.findUnique({
        where: { id: input.veiculoId },
        select: { id: true, tipoFrota: true, ativo: true },
      }),
    ]);

    if (!motorista || !motorista.ativo) {
      throw new HttpError(422, "Motorista inválido ou inativo.", [
        { campo: "motoristaId", mensagem: "Selecione um motorista ativo." },
      ]);
    }
    if (dataDoBanco(motorista.validadeCnh) < dataLocal(fim)) {
      throw new HttpError(422, "CNH do motorista vence antes do fim do turno.", [
        { campo: "motoristaId", mensagem: "CNH vencida ou vencendo durante o turno." },
      ]);
    }
    if (!veiculo || veiculo.tipoFrota !== "SVO" || !veiculo.ativo) {
      throw new HttpError(422, "Viatura SVO inválida ou inativa.", [
        { campo: "veiculoId", mensagem: "Selecione uma viatura SVO ativa." },
      ]);
    }

    const candidatas = await tx.escalaSvo.findMany({
      where: {
        motoristaId: motorista.id,
        inicioTurno: { lt: fim },
        fimTurno: { gt: inicio },
      },
      select: { id: true, inicioTurno: true, fimTurno: true, encerradaEm: true },
    });
    if (candidatas.some((escala) => turnosSeSobrepoem(escala, inicio, fim))) {
      throw new HttpError(409, "Motorista já escalado em um turno que se sobrepõe a este.", [
        { campo: "inicioTurno", mensagem: "Há outra escala do motorista neste horário." },
      ]);
    }

    const escala = await tx.escalaSvo.create({
      data: {
        motoristaId: motorista.id,
        veiculoId: veiculo.id,
        inicioTurno: inicio,
        fimTurno: fim,
        observacoes: input.observacoes,
      },
      include: incluirRelacoes,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "CRIAR",
        tabelaAfetada: "escalas_svo",
        registroId: escala.id,
        dadosNovos: {
          motoristaId: escala.motoristaId,
          veiculoId: escala.veiculoId,
          inicioTurno: escala.inicioTurno.toISOString(),
          fimTurno: escala.fimTurno.toISOString(),
        },
      },
    });

    return serializarEscala(escala, agora);
  });
}

export async function encerrarEscalaSvo(id: string, usuarioId: string, agora = new Date()) {
  return transacionar(async (tx) => {
    const { count } = await tx.escalaSvo.updateMany({
      where: { id, encerradaEm: null, fimTurno: { gt: agora } },
      data: { encerradaEm: agora },
    });
    if (count === 0) {
      const existe = await tx.escalaSvo.findUnique({ where: { id }, select: { id: true } });
      if (!existe) throw new HttpError(404, "Escala não encontrada.");
      throw new HttpError(409, "Esta escala já está encerrada.");
    }

    const escala = await tx.escalaSvo.findUniqueOrThrow({
      where: { id },
      include: incluirRelacoes,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "ENCERRAR",
        tabelaAfetada: "escalas_svo",
        registroId: escala.id,
        dadosNovos: {
          encerradaEm: agora.toISOString(),
          cancelada: escala.inicioTurno > agora,
        },
      },
    });

    return serializarEscala(escala, agora);
  });
}
