import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { type UsuarioAutenticado } from "../middleware/http_m";
import { HttpError } from "../lib/http_error";
import { notificarSolicitacaoUrgente, notificarSolicitacaoCancelada } from "./notificacao_s";

export const STATUS_SOLICITACAO = [
  "PENDENTE",
  "APROVADA",
  "EM_TRANSITO",
  "CONCLUIDA",
  "RECUSADA",
  "CANCELADA",
] as const;
export const URGENCIAS = ["NORMAL", "URGENTE"] as const;
export const TIPOS_TRANSPORTE = [
  "PASSAGEIROS",
  "MATERIAL_BIOLOGICO",
  "DOCUMENTOS_INSUMOS",
  "MISTO",
] as const;

export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];
export const PERFIS_GESTAO = ["ADMIN", "GESTOR"];
const TIPOS_SEM_PASSAGEIRO: readonly string[] = ["MATERIAL_BIOLOGICO", "DOCUMENTOS_INSUMOS"];

export const MAX_PASSAGEIROS = 15;
export const TOLERANCIA_SAIDA_MS = 3 * 60 * 1000;

const PREFIXO_PROTOCOLO = "SV";
const FUSO_PROTOCOLO = "America/Maceio";

function texto(campo: string, min: number, max: number) {
  return z
    .string({ error: `${campo} é obrigatório.` })
    .trim()
    .min(min, `${campo} deve ter ao menos ${min} caracteres.`)
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`);
}

function dataHora(campo: string) {
  return z.iso
    .datetime({
      offset: true,
      error: `Informe uma data e hora válidas para ${campo.toLocaleLowerCase("pt-BR")}.`,
    })
    .transform((valor) => new Date(valor));
}

export const criarSolicitacaoSchema = z
  .object({
    setorOrigem: texto("Setor de origem", 2, 100),
    origem: texto("Origem", 3, 150),
    destino: texto("Destino", 3, 150),
    dataHoraPretendida: dataHora("Data e hora de saída"),
    dataHoraRetornoPrevista: dataHora("Retorno previsto")
      .nullish()
      .transform((valor) => valor ?? undefined),
    quantidadePassageiros: z
      .number({ error: "Informe a quantidade de passageiros." })
      .int("Informe a quantidade de passageiros sem casas decimais.")
      .min(0, "Quantidade de passageiros não pode ser negativa.")
      .max(MAX_PASSAGEIROS, `Máximo de ${MAX_PASSAGEIROS} passageiros por viagem.`)
      .default(1),
    tipoTransporte: z
      .enum(TIPOS_TRANSPORTE, { error: "Tipo de transporte inválido." })
      .default("PASSAGEIROS"),
    urgencia: z
      .enum(URGENCIAS, { error: "Selecione a prioridade normal ou urgente." })
      .default("NORMAL"),
    justificativa: texto("Justificativa", 10, 500),
    observacoes: z
      .string({ error: "Confira as observações informadas." })
      .trim()
      .max(300, "Observações devem ter no máximo 300 caracteres.")
      .nullish()
      .transform((valor) => valor || undefined),
  })
  .superRefine((dados, ctx) => {
    const saida = dados.dataHoraPretendida;
    const retorno = dados.dataHoraRetornoPrevista;
    if (saida instanceof Date && saida.getTime() < Date.now() - TOLERANCIA_SAIDA_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["dataHoraPretendida"],
        message: "A data de saída deve ser futura.",
      });
    }
    if (saida instanceof Date && retorno instanceof Date && retorno.getTime() <= saida.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["dataHoraRetornoPrevista"],
        message: "O retorno deve ser posterior à saída.",
      });
    }
    if (
      typeof dados.tipoTransporte === "string" &&
      typeof dados.quantidadePassageiros === "number" &&
      !TIPOS_SEM_PASSAGEIRO.includes(dados.tipoTransporte) &&
      dados.quantidadePassageiros < 1
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["quantidadePassageiros"],
        message: "Informe ao menos 1 passageiro para este tipo de transporte.",
      });
    }
  });

function listaDaQuery(valor: unknown) {
  const itens = (Array.isArray(valor) ? valor : [valor])
    .flatMap((item) => (typeof item === "string" ? item.split(",") : [item]))
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter((item) => item !== "" && item !== undefined);
  return itens.length ? itens : undefined;
}

export const listarSolicitacoesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.preprocess(
    listaDaQuery,
    z
      .array(z.enum(STATUS_SOLICITACAO, { error: "Selecione uma situação válida na lista." }))
      .optional(),
  ),
  urgencia: z.enum(URGENCIAS, { error: "Urgência inválida." }).optional(),
  tipoTransporte: z.enum(TIPOS_TRANSPORTE, { error: "Tipo de transporte inválido." }).optional(),
  setorOrigem: z
    .string()
    .trim()
    .max(100, "Setor de origem deve ter no máximo 100 caracteres.")
    .transform((valor) => valor || undefined)
    .optional(),
  busca: z
    .string()
    .trim()
    .max(100, "Busca deve ter no máximo 100 caracteres.")
    .transform((valor) => valor || undefined)
    .optional(),
});

export type CriarSolicitacaoInput = z.infer<typeof criarSolicitacaoSchema>;
export type ListarSolicitacoesFiltros = z.infer<typeof listarSolicitacoesSchema>;

const incluirRelacoes = {
  solicitante: { select: { nome: true } },
  veiculoAlocado: { select: { placa: true, modelo: true } },
  motoristaAlocado: { select: { usuario: { select: { nome: true } } } },
} satisfies Prisma.SolicitacaoViagemInclude;

type SolicitacaoComRelacoes = Prisma.SolicitacaoViagemGetPayload<{
  include: typeof incluirRelacoes;
}>;

export function serializarSolicitacao(registro: SolicitacaoComRelacoes) {
  const { solicitante, veiculoAlocado, motoristaAlocado, ...dados } = registro;
  return {
    ...dados,
    solicitanteNome: solicitante.nome,
    veiculoAlocado: veiculoAlocado
      ? { placa: veiculoAlocado.placa, modelo: veiculoAlocado.modelo }
      : null,
    motoristaAlocado: motoristaAlocado ? { nome: motoristaAlocado.usuario?.nome ?? null } : null,
  };
}

export type SolicitacaoResposta = ReturnType<typeof serializarSolicitacao>;

export function anoDoProtocolo(data: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO_PROTOCOLO, year: "numeric" }).format(data),
  );
}

export function formatarProtocolo(ano: number, numero: number): string {
  return `${PREFIXO_PROTOCOLO}-${ano}-${String(numero).padStart(4, "0")}`;
}

async function gerarProtocolo(tx: Prisma.TransactionClient, agora: Date): Promise<string> {
  const ano = anoDoProtocolo(agora);
  const [contador] = await tx.$queryRaw<Array<{ ultimo_valor: number }>>`
    INSERT INTO "contadores_protocolo" ("prefixo", "ano", "ultimo_valor")
    VALUES (${PREFIXO_PROTOCOLO}, ${ano}, 1)
    ON CONFLICT ("prefixo", "ano")
    DO UPDATE SET "ultimo_valor" = "contadores_protocolo"."ultimo_valor" + 1
    RETURNING "ultimo_valor"`;
  return formatarProtocolo(ano, Number(contador.ultimo_valor));
}

export function podeVerTodas(usuario: UsuarioAutenticado): boolean {
  return usuario.perfis.some((perfil) => PERFIS_GESTAO.includes(perfil));
}

export async function listarSolicitacoes(
  filtros: ListarSolicitacoesFiltros,
  usuario: UsuarioAutenticado,
) {
  const acesso = podeVerTodas(usuario) ? {} : { solicitanteId: usuario.id };
  return consultarSolicitacoes(filtros, acesso, async (consulta) => {
    const registros = await prisma.solicitacaoViagem.findMany({
      ...consulta,
      include: incluirRelacoes,
    });
    return registros.map(serializarSolicitacao);
  });
}

const incluirRelacoesMotorista = {
  ...incluirRelacoes,
  veiculoAlocado: { select: { placa: true, modelo: true, odometroAtual: true } },
  execucao: {
    select: { id: true, kmInicial: true, kmFinal: true, dataHoraInicio: true, dataHoraFim: true },
  },
} satisfies Prisma.SolicitacaoViagemInclude;

function serializarViagem(
  registro: Prisma.SolicitacaoViagemGetPayload<{ include: typeof incluirRelacoesMotorista }>,
) {
  return { ...serializarSolicitacao(registro), veiculoAlocado: registro.veiculoAlocado };
}

export async function listarMinhasViagens(filtros: ListarSolicitacoesFiltros, usuarioId: string) {
  const acesso = { motoristaAlocado: { usuarioId, ativo: true } };
  const [resultado, emAndamento] = await Promise.all([
    consultarSolicitacoes(
      filtros,
      { ...acesso, NOT: { status: "EM_TRANSITO" } },
      async (consulta) => {
        const registros = await prisma.solicitacaoViagem.findMany({
          ...consulta,
          include: incluirRelacoesMotorista,
          orderBy: [{ status: "asc" }, { dataHoraPretendida: "asc" }, { id: "asc" }],
        });
        return registros.map(serializarViagem);
      },
    ),
    prisma.solicitacaoViagem.findFirst({
      where: { ...acesso, status: "EM_TRANSITO" },
      include: incluirRelacoesMotorista,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    }),
  ]);

  return { ...resultado, viagemEmAndamento: emAndamento ? serializarViagem(emAndamento) : null };
}

async function consultarSolicitacoes<T>(
  filtros: ListarSolicitacoesFiltros,
  acesso: Prisma.SolicitacaoViagemWhereInput,
  listar: (
    consulta: Pick<Prisma.SolicitacaoViagemFindManyArgs, "where" | "orderBy" | "skip" | "take">,
  ) => Promise<T[]>,
) {
  const { page, pageSize, status, urgencia, tipoTransporte, setorOrigem, busca } = filtros;

  const whereBase: Prisma.SolicitacaoViagemWhereInput = {
    ...acesso,
    ...(urgencia ? { urgencia } : {}),
    ...(tipoTransporte ? { tipoTransporte } : {}),
    ...(setorOrigem ? { setorOrigem } : {}),
    ...(busca
      ? {
          OR: [
            { protocolo: { contains: busca, mode: "insensitive" } },
            { origem: { contains: busca, mode: "insensitive" } },
            { destino: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const where: Prisma.SolicitacaoViagemWhereInput = {
    ...whereBase,
    ...(status ? { status: { in: status } } : {}),
  };

  const [data, total, grupos] = await Promise.all([
    listar({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitacaoViagem.count({ where }),
    prisma.solicitacaoViagem.groupBy({
      by: ["status"],
      where: whereBase,
      _count: { _all: true },
    }),
  ]);

  const porStatus = Object.fromEntries(STATUS_SOLICITACAO.map((s) => [s, 0])) as Record<
    StatusSolicitacao,
    number
  >;
  for (const grupo of grupos) {
    if (grupo.status in porStatus) {
      porStatus[grupo.status as StatusSolicitacao] = grupo._count._all;
    }
  }

  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), porStatus },
  };
}

export async function criarSolicitacao(
  input: CriarSolicitacaoInput,
  usuarioId: string,
  agora: Date = new Date(),
) {
  const solicitante = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { ativo: true },
  });
  if (!solicitante?.ativo) {
    throw new HttpError(
      403,
      "Seu acesso não está disponível. Entre em contato com o administrador.",
    );
  }

  const registro = await prisma.$transaction(
    async (tx) => {
      const protocolo = await gerarProtocolo(tx, agora);

      const criada = await tx.solicitacaoViagem.create({
        data: { ...input, protocolo, status: "PENDENTE", solicitanteId: usuarioId },
        include: incluirRelacoes,
      });

      await tx.auditoriaSistema.create({
        data: {
          usuarioId,
          acao: "CRIAR",
          tabelaAfetada: "solicitacoes_viagem",
          registroId: criada.id,
          dadosNovos: {
            protocolo: criada.protocolo,
            status: criada.status,
            urgencia: criada.urgencia,
            tipoTransporte: criada.tipoTransporte,
            setorOrigem: criada.setorOrigem,
            origem: criada.origem,
            destino: criada.destino,
            quantidadePassageiros: criada.quantidadePassageiros,
            dataHoraPretendida: criada.dataHoraPretendida?.toISOString() ?? null,
            dataHoraRetornoPrevista: criada.dataHoraRetornoPrevista?.toISOString() ?? null,
          },
        },
      });

      return criada;
    },
    { maxWait: 5000, timeout: 10000 },
  );

  if (registro.urgencia === "URGENTE") {
    await notificarSolicitacaoUrgente({
      id: registro.id,
      protocolo: registro.protocolo,
      setorOrigem: registro.setorOrigem,
      destino: registro.destino,
    });
  }

  return serializarSolicitacao(registro);
}

export const cancelarSolicitacaoSchema = z.object({
  motivoCancelamento: z
    .string({ error: "Informe a justificativa do cancelamento." })
    .trim()
    .min(3, "A justificativa deve ter ao menos 3 caracteres.")
    .max(500, "A justificativa deve ter no máximo 500 caracteres."),
});

export type CancelarSolicitacaoInput = z.infer<typeof cancelarSolicitacaoSchema>;

export async function cancelarSolicitacao(
  id: string,
  dados: CancelarSolicitacaoInput,
  usuario: UsuarioAutenticado,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(
      400,
      "Não foi possível identificar a solicitação. Atualize a lista e tente novamente.",
    );
  }

  const solicitacaoExistente = await prisma.solicitacaoViagem.findUnique({
    where: { id },
    include: {
      motoristaAlocado: {
        select: {
          usuarioId: true,
        },
      },
    },
  });

  if (!solicitacaoExistente) {
    throw new HttpError(404, "Solicitação não encontrada.");
  }

  const ehGestorOuAdmin = usuario.perfis.some((p) => PERFIS_GESTAO.includes(p));
  if (!ehGestorOuAdmin && solicitacaoExistente.solicitanteId !== usuario.id) {
    throw new HttpError(403, "Você não tem permissão para cancelar esta solicitação.");
  }

  if (
    solicitacaoExistente.status === "EM_TRANSITO" ||
    solicitacaoExistente.status === "CONCLUIDA"
  ) {
    throw new HttpError(
      409,
      "Não é possível cancelar uma viagem que já está em trânsito ou foi concluída.",
    );
  }

  if (solicitacaoExistente.status === "CANCELADA") {
    throw new HttpError(409, "Esta solicitação já foi cancelada.");
  }

  if (solicitacaoExistente.status === "RECUSADA") {
    throw new HttpError(409, "Esta solicitação foi recusada e não pode ser cancelada.");
  }

  const cancelada = await prisma.$transaction(async (tx) => {
    const registro = await tx.solicitacaoViagem.update({
      where: { id },
      data: {
        status: "CANCELADA",
        motivoCancelamento: dados.motivoCancelamento,
        veiculoAlocadoId: null,
        motoristaAlocadoId: null,
      },
      include: incluirRelacoes,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: "CANCELAR",
        tabelaAfetada: "solicitacoes_viagem",
        registroId: id,
        dadosNovos: {
          status: "CANCELADA",
          statusAnterior: solicitacaoExistente.status,
          protocolo: solicitacaoExistente.protocolo,
          motivoCancelamento: dados.motivoCancelamento,
          veiculoAlocadoIdAnterior: solicitacaoExistente.veiculoAlocadoId,
          motoristaAlocadoIdAnterior: solicitacaoExistente.motoristaAlocadoId,
        },
      },
    });

    return registro;
  });

  await notificarSolicitacaoCancelada({
    id: solicitacaoExistente.id,
    protocolo: solicitacaoExistente.protocolo,
    solicitanteId: solicitacaoExistente.solicitanteId,
    motivoCancelamento: dados.motivoCancelamento,
    canceladoPorId: usuario.id,
    motoristaUsuarioId: solicitacaoExistente.motoristaAlocado?.usuarioId ?? null,
    destino: solicitacaoExistente.destino,
  });

  return serializarSolicitacao(cancelada);
}
