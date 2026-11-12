import { diarioConfig } from "../config/diario";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { notificarViaturaSvoLiberada } from "./notificacao_s";

import { STATUS_ORDEM_ATIVA, STATUS_ORDEM_EM_COLETA } from "./svo_status";
export { STATUS_ORDEM_ATIVA, STATUS_ORDEM_EM_COLETA } from "./svo_status";
const PREFIXO_PROTOCOLO_SVO = "SVO";
const FUSO_PROTOCOLO = "America/Maceio";

export const criarChamadoSchema = z
  .object({
    nomeFalecido: z
      .string({ error: "Nome do falecido é obrigatório." })
      .trim()
      .min(2, "Nome do falecido deve ter ao menos 2 caracteres.")
      .max(150, "Nome do falecido deve ter no máximo 150 caracteres."),
    enderecoOcorrencia: z
      .string({ error: "Endereço da ocorrência é obrigatório." })
      .trim()
      .min(3, "Endereço da ocorrência deve ter ao menos 3 caracteres.")
      .max(300, "Endereço da ocorrência deve ter no máximo 300 caracteres."),
    relatoOcorrencia: z
      .string({ error: "Relato da ocorrência é obrigatório." })
      .trim()
      .min(5, "Relato da ocorrência deve ter ao menos 5 caracteres.")
      .max(1000, "Relato da ocorrência deve ter no máximo 1000 caracteres."),
  })
  .strict();

export const triagemSchema = z
  .object({
    decisao: z.enum(["APROVAR", "RECUSAR"], {
      error: "Escolha se deseja aprovar ou recusar o chamado.",
    }),
    justificativa: z
      .string({ error: "Descreva a justificativa." })
      .trim()
      .min(3, "Justificativa deve ter ao menos 3 caracteres.")
      .max(500, "Justificativa deve ter no máximo 500 caracteres.")
      .optional(),
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
    veiculoId: z.uuid("Selecione uma viatura válida."),
    motoristaId: z.uuid("Selecione um motorista válido."),
    numeroDeclaracaoObito: z
      .string({ error: "Confira o número da declaração de óbito." })
      .trim()
      .max(50, "Declaração de óbito deve ter no máximo 50 caracteres.")
      .optional(),
  })
  .strict();

export const criarOrdemSchema = emitirOrdemSchema.extend({
  chamadoId: z.uuid("Selecione um chamado válido."),
});

export const avancarEtapaSchema = z
  .object({
    status: z.enum(["EM_DESLOCAMENTO", "NO_LOCAL", "ENTREGUE_SVO"]),
  })
  .strict();

const etapaAnterior = {
  EM_DESLOCAMENTO: "AGUARDANDO_DESPACHO",
  NO_LOCAL: "EM_DESLOCAMENTO",
  ENTREGUE_SVO: "NO_LOCAL",
} as const;

const buscaQuerySchema = z.preprocess((valor) => {
  if (typeof valor === "string" && valor.trim() === "") return undefined;
  return valor;
}, z.string().trim().max(100, "Busca deve ter no máximo 100 caracteres.").optional());

export const listarChamadosSchema = z.object({
  status: z.enum(["EM_ANALISE", "APROVADO", "RECUSADO"]).optional(),
  etapa: z.enum(["TODOS", "EM_ANALISE", "AGUARDANDO_ORDEM", "EM_OPERACAO", "ENCERRADO"]).optional(),
  busca: buscaQuerySchema,
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function dataHojeUTC(referencia: Date = new Date()): Date {
  return new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate()),
  );
}

async function gerarProtocoloSvo(tx: Prisma.TransactionClient, agora: Date): Promise<string> {
  const ano = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO_PROTOCOLO, year: "numeric" }).format(agora),
  );
  const [contador] = await tx.$queryRaw<Array<{ ultimo_valor: number }>>`
    INSERT INTO "contadores_protocolo" ("prefixo", "ano", "ultimo_valor")
    VALUES (${PREFIXO_PROTOCOLO_SVO}, ${ano}, 1)
    ON CONFLICT ("prefixo", "ano")
    DO UPDATE SET "ultimo_valor" = "contadores_protocolo"."ultimo_valor" + 1
    RETURNING "ultimo_valor"
  `;
  return `${PREFIXO_PROTOCOLO_SVO}-${ano}-${String(Number(contador.ultimo_valor)).padStart(4, "0")}`;
}

const incluirRelacoesChamado = {
  atendente: { select: { id: true, nome: true } },
  ordemColeta: {
    include: {
      veiculo: {
        select: {
          id: true,
          placa: true,
          modelo: true,
          status: true,
          capacidadeMaxima: true,
        },
      },
      motorista: {
        select: {
          id: true,
          numeroCnh: true,
          categoriaCnh: true,
          usuario: { select: { nome: true } },
        },
      },
    },
  },
} satisfies Prisma.ChamadoSvoInclude;

function construirWhereChamados(
  filtros: z.infer<typeof listarChamadosSchema>,
): Prisma.ChamadoSvoWhereInput {
  const condicoes: Prisma.ChamadoSvoWhereInput[] = [];

  if (filtros.status) {
    condicoes.push({ statusTriagem: filtros.status });
  }

  if (filtros.etapa && filtros.etapa !== "TODOS") {
    if (filtros.etapa === "EM_ANALISE") {
      condicoes.push({ statusTriagem: "EM_ANALISE" });
    } else if (filtros.etapa === "AGUARDANDO_ORDEM") {
      condicoes.push({ statusTriagem: "APROVADO", ordemColeta: { is: null } });
    } else if (filtros.etapa === "EM_OPERACAO") {
      condicoes.push({
        statusTriagem: "APROVADO",
        ordemColeta: { is: { status: { in: [...STATUS_ORDEM_ATIVA] } } },
      });
    } else if (filtros.etapa === "ENCERRADO") {
      condicoes.push({
        OR: [
          { statusTriagem: "RECUSADO" },
          { ordemColeta: { is: { status: { in: ["CONCLUIDA", "ENTREGUE_SVO", "CANCELADA"] } } } },
        ],
      });
    }
  }

  if (filtros.busca) {
    condicoes.push({
      OR: [
        { numeroProtocolo: { contains: filtros.busca, mode: "insensitive" } },
        { nomeFalecido: { contains: filtros.busca, mode: "insensitive" } },
        { enderecoOcorrencia: { contains: filtros.busca, mode: "insensitive" } },
        { relatoOcorrencia: { contains: filtros.busca, mode: "insensitive" } },
      ],
    });
  }

  if (condicoes.length === 0) return {};
  if (condicoes.length === 1) return condicoes[0]!;
  return { AND: condicoes };
}

export const listarMinhasOrdensSvoSchema = z
  .object({
    ativas: z.enum(["true", "false"]).optional(),
    status: z
      .enum([
        "AGUARDANDO_DESPACHO",
        "EM_ANDAMENTO",
        "EM_DESLOCAMENTO",
        "NO_LOCAL",
        "ENTREGUE_SVO",
        "CONCLUIDA",
        "CANCELADA",
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();

export async function listarMinhasOrdensSvo(
  usuarioId: string,
  filtros: z.infer<typeof listarMinhasOrdensSvoSchema>,
) {
  const where: Prisma.OrdemColetaSvoWhereInput = {
    motorista: { is: { usuarioId, ativo: true } },
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.ativas === "true" ? { AND: { status: { in: [...STATUS_ORDEM_ATIVA] } } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.ordemColetaSvo.findMany({
      where,
      include: {
        chamado: true,
        veiculo: {
          select: { id: true, placa: true, modelo: true, status: true, capacidadeMaxima: true },
        },
      },
      orderBy: [{ chamado: { criadoEm: "desc" } }, { id: "desc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.ordemColetaSvo.count({ where }),
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

function ehOperacaoDaCentral(perfis: string[]) {
  return perfis.includes("ADMIN") || perfis.includes("SVO");
}

async function motoristaAtivoDoUsuario(usuarioId: string) {
  const motorista = await prisma.motorista.findUnique({
    where: { usuarioId },
    select: { id: true, ativo: true },
  });
  if (!motorista?.ativo) {
    throw new HttpError(403, "Seu usuário não está vinculado a um motorista ativo.");
  }
  return motorista.id;
}

export async function obterSlaRespostaSvo() {
  const ordensSla = await prisma.ordemColetaSvo.findMany({
    where: { status: { not: "CANCELADA" } },
    select: {
      chamado: { select: { criadoEm: true } },
      dataHoraChegadaLocal: true,
      dataHoraEntregaSvo: true,
    },
  });

  const chegada: number[] = [];
  const entrega: number[] = [];
  for (const ordem of ordensSla) {
    const abertura = ordem.chamado.criadoEm?.getTime();
    if (abertura === undefined || !Number.isFinite(abertura)) continue;
    const local = ordem.dataHoraChegadaLocal?.getTime();
    const svo = ordem.dataHoraEntregaSvo?.getTime();
    if (local !== undefined && Number.isFinite(local) && local >= abertura) {
      chegada.push((local - abertura) / 60000);
    }
    if (
      svo !== undefined &&
      Number.isFinite(svo) &&
      svo >= abertura &&
      (local === undefined || (Number.isFinite(local) && local >= abertura && svo >= local))
    ) {
      entrega.push((svo - abertura) / 60000);
    }
  }
  const media = (tempos: number[]) =>
    tempos.length ? tempos.reduce((soma, tempo) => soma + tempo, 0) / tempos.length : null;
  const tempoMedioChegadaLocalMinutos = media(chegada);
  const tempoMedioEntregaSvoMinutos = media(entrega);

  return {
    tempoMedioChamadoChegadaLocalMinutos: tempoMedioChegadaLocalMinutos,
    tempoMedioChamadoEntregaSvoMinutos: tempoMedioEntregaSvoMinutos,
    amostrasChegadaLocal: chegada.length,
    amostrasEntregaSvo: entrega.length,
    tempoMedioChegadaLocalMinutos,
    tempoMedioEntregaSvoMinutos,
  };
}

export async function indicadoresSvo() {
  const [
    total,
    emAnalise,
    aguardandoOrdem,
    aprovados,
    recusados,
    coletasEmAndamento,
    viaturasDisponiveis,
    totalViaturas,
    sla,
  ] = await Promise.all([
    prisma.chamadoSvo.count(),
    prisma.chamadoSvo.count({ where: { statusTriagem: "EM_ANALISE" } }),
    prisma.chamadoSvo.count({
      where: { statusTriagem: "APROVADO", ordemColeta: { is: null } },
    }),
    prisma.chamadoSvo.count({ where: { statusTriagem: "APROVADO" } }),
    prisma.chamadoSvo.count({ where: { statusTriagem: "RECUSADO" } }),
    prisma.ordemColetaSvo.count({ where: { status: { in: [...STATUS_ORDEM_EM_COLETA] } } }),
    prisma.veiculo.count({ where: { tipoFrota: "SVO", ativo: true, status: "DISPONIVEL" } }),
    prisma.veiculo.count({ where: { tipoFrota: "SVO", ativo: true } }),
    obterSlaRespostaSvo(),
  ]);

  return {
    total,
    emAnalise,
    aguardandoOrdem,
    aprovados,
    recusados,
    coletasEmAndamento,
    viaturasDisponiveis,
    totalViaturas,
    ...sla,
  };
}

export async function listarChamadosSvo(filtros: z.infer<typeof listarChamadosSchema>) {
  const where = construirWhereChamados(filtros);
  const [registros, total] = await Promise.all([
    prisma.chamadoSvo.findMany({
      where,
      include: incluirRelacoesChamado,
      orderBy: [{ numeroProtocolo: "desc" }, { id: "desc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.chamadoSvo.count({ where }),
  ]);

  const ids = registros.map((item) => item.id);
  const auditoriasTriagem =
    ids.length > 0
      ? await prisma.auditoriaSistema.findMany({
          where: {
            tabelaAfetada: "chamados_svo",
            registroId: { in: ids },
            acao: { in: ["TRIAGEM_APROVAR", "TRIAGEM_RECUSAR"] },
          },
          orderBy: { criadoEm: "desc" },
          select: { registroId: true, dadosNovos: true },
        })
      : [];

  const justificativaPorId = new Map<string, string>();
  for (const item of auditoriasTriagem) {
    if (!item.registroId || justificativaPorId.has(item.registroId)) continue;
    const dados = item.dadosNovos as { justificativa?: unknown } | null;
    if (typeof dados?.justificativa === "string" && dados.justificativa.trim()) {
      justificativaPorId.set(item.registroId, dados.justificativa.trim());
    }
  }

  const data = registros.map((registro) => ({
    ...registro,
    justificativaTriagem: justificativaPorId.get(registro.id) ?? null,
  }));

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
  agora: Date = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const numeroProtocolo = await gerarProtocoloSvo(tx, agora);
    const chamado = await tx.chamadoSvo.create({
      data: {
        ...input,
        numeroProtocolo,
        atendenteId,
        criadoEm: agora,
      },
      include: incluirRelacoesChamado,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: atendenteId,
        acao: "CRIAR",
        tabelaAfetada: "chamados_svo",
        registroId: chamado.id,
        dadosNovos: {
          numeroProtocolo: chamado.numeroProtocolo,
          nomeFalecido: chamado.nomeFalecido,
          enderecoOcorrencia: chamado.enderecoOcorrencia,
          statusTriagem: chamado.statusTriagem,
        },
      },
    });

    return { ...chamado, justificativaTriagem: null };
  });
}

export async function realizarTriagemSvo(
  id: string,
  input: z.infer<typeof triagemSchema>,
  usuarioId?: string,
) {
  const statusTriagem = input.decisao === "APROVAR" ? "APROVADO" : "RECUSADO";

  return prisma.$transaction(async (tx) => {
    const result = await tx.chamadoSvo.updateMany({
      where: { id, statusTriagem: "EM_ANALISE" },
      data: { statusTriagem },
    });

    if (result.count === 0) {
      const exists = await tx.chamadoSvo.findUnique({ where: { id }, select: { id: true } });
      throw new HttpError(
        exists ? 409 : 404,
        exists ? "Chamado já triado." : "Chamado não encontrado.",
      );
    }

    const atualizado = await tx.chamadoSvo.findUniqueOrThrow({
      where: { id },
      include: incluirRelacoesChamado,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao: input.decisao === "APROVAR" ? "TRIAGEM_APROVAR" : "TRIAGEM_RECUSAR",
        tabelaAfetada: "chamados_svo",
        registroId: id,
        dadosNovos: {
          numeroProtocolo: atualizado.numeroProtocolo,
          statusTriagem,
          justificativa: input.justificativa ?? null,
        },
      },
    });

    return {
      ...atualizado,
      justificativaTriagem: input.justificativa ?? null,
    };
  });
}

async function transacionarSvo<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(operacao, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034", "P2028"].includes(error.code)
    ) {
      throw new HttpError(
        409,
        "Operação SVO em conflito com outra atualização. Atualize os dados e tente novamente.",
      );
    }
    throw error;
  }
}

async function bloquearRecursosSvo(
  tx: Prisma.TransactionClient,
  veiculoId?: string | null,
  motoristaId?: string | null,
  chamadoId?: string,
) {
  // Mesma ordem e chaves da aprovação de solicitações e das manutenções.
  const recursos = [motoristaId && `motorista:${motoristaId}`, veiculoId && `veiculo:${veiculoId}`]
    .filter((valor): valor is string => Boolean(valor))
    .sort();
  for (const recurso of recursos) {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${recurso}, 0))`;
  }
  if (motoristaId)
    await tx.$queryRaw`SELECT id FROM motoristas WHERE id = ${motoristaId}::uuid FOR UPDATE`;
  if (veiculoId)
    await tx.$queryRaw`SELECT id FROM veiculos WHERE id = ${veiculoId}::uuid FOR UPDATE`;
  if (chamadoId)
    await tx.$queryRaw`SELECT id FROM chamados_svo WHERE id = ${chamadoId}::uuid FOR UPDATE`;
}

export async function emitirOrdemColetaSvo(
  chamadoId: string,
  input: z.infer<typeof emitirOrdemSchema>,
  usuarioId?: string,
) {
  return transacionarSvo(async (tx) => {
    await bloquearRecursosSvo(tx, input.veiculoId, input.motoristaId, chamadoId);

    const [chamado, veiculo, motorista, ordensAtivasVeiculo] = await Promise.all([
      tx.chamadoSvo.findUnique({ where: { id: chamadoId }, include: { ordemColeta: true } }),
      tx.veiculo.findUnique({ where: { id: input.veiculoId } }),
      tx.motorista.findUnique({ where: { id: input.motoristaId } }),
      tx.ordemColetaSvo.findMany({
        where: {
          veiculoId: input.veiculoId,
          status: { in: [...STATUS_ORDEM_ATIVA] },
        },
        select: { id: true, motoristaId: true },
      }),
    ]);

    if (!chamado) throw new HttpError(404, "Chamado não encontrado.");
    if (chamado.statusTriagem !== "APROVADO") {
      throw new HttpError(409, "Chamado precisa ser aprovado na triagem.");
    }
    if (chamado.ordemColeta) {
      throw new HttpError(409, "Chamado já possui ordem de coleta.");
    }
    if (!veiculo || veiculo.tipoFrota !== "SVO" || !veiculo.ativo) {
      throw new HttpError(422, "Viatura SVO indisponível ou inválida.");
    }
    if (veiculo.status === "DESINFECCAO") {
      throw new HttpError(422, "Viatura bloqueada aguardando confirmação de desinfecção.");
    }
    if (!["DISPONIVEL", "EM_VIAGEM"].includes(veiculo.status)) {
      throw new HttpError(422, "Viatura SVO indisponível ou em manutenção.");
    }
    if (veiculo.capacidadeMaxima < 1 || ordensAtivasVeiculo.length >= veiculo.capacidadeMaxima) {
      throw new HttpError(422, "Capacidade máxima da viatura atingida para esta operação.");
    }

    if (!motorista || !motorista.ativo) {
      throw new HttpError(422, "Motorista indisponível ou inválido.");
    }

    const outraViatura = await tx.ordemColetaSvo.findFirst({
      where: {
        motoristaId: motorista.id,
        veiculoId: { not: veiculo.id },
        status: { in: [...STATUS_ORDEM_ATIVA] },
      },
      select: { id: true },
    });
    if (outraViatura || ordensAtivasVeiculo.some((ordem) => ordem.motoristaId !== motorista.id)) {
      throw new HttpError(422, "Motorista indisponível ou alocado em outra operação.");
    }

    const motoristaJaNaViatura = ordensAtivasVeiculo.some(
      (ordem) => ordem.motoristaId === motorista.id,
    );

    if (
      motorista.status !== "DISPONIVEL" &&
      !(motorista.status === "OCUPADO" && motoristaJaNaViatura)
    ) {
      throw new HttpError(422, "Motorista indisponível ou alocado em outra operação.");
    }

    if (motorista.validadeCnh < dataHojeUTC()) {
      throw new HttpError(422, "CNH do motorista vencida.");
    }

    if (diarioConfig().enabled) {
      const ativa = await tx.saidaOperacional.findFirst({
        where: {
          status: "EM_ANDAMENTO",
          OR: [{ motoristaId: motorista.id }, { veiculoId: veiculo.id }],
        },
      });
      const conflito = await tx.solicitacaoViagem.findFirst({
        where: {
          motoristaAlocadoId: motorista.id,
          status: { in: ["APROVADA", "EM_TRANSITO"] },
          OR: [{ status: "EM_TRANSITO" }, { dataHoraRetornoPrevista: { gte: new Date() } }],
        },
      });
      if (ativa || conflito)
        throw new HttpError(409, "Recursos já alocados em saída ou viagem administrativa.");
    }
    const ordem = await tx.ordemColetaSvo.create({
      data: {
        chamadoId,
        veiculoId: veiculo.id,
        motoristaId: motorista.id,
        numeroDeclaracaoObito: input.numeroDeclaracaoObito || undefined,
        status: "AGUARDANDO_DESPACHO",
        dataHoraSaida: null,
      },
    });

    await tx.motorista.update({ where: { id: motorista.id }, data: { status: "OCUPADO" } });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao: "EMITIR_ORDEM",
        tabelaAfetada: "ordens_coleta_svo",
        registroId: ordem.id,
        dadosNovos: {
          chamadoId,
          veiculoId: veiculo.id,
          motoristaId: motorista.id,
          numeroDeclaracaoObito: ordem.numeroDeclaracaoObito,
          status: ordem.status,
        },
      },
    });

    return ordem;
  });
}

export async function avancarEtapaColetaSvo(
  ordemId: string,
  status: z.infer<typeof avancarEtapaSchema>["status"],
  usuarioId: string,
  perfis: string[] = ["SVO"],
) {
  const ordem = await prisma.ordemColetaSvo.findUnique({
    where: { id: ordemId },
    select: { chamadoId: true, motoristaId: true },
  });
  if (!ordem) throw new HttpError(404, "Ordem de coleta não encontrada.");
  if (!ehOperacaoDaCentral(perfis)) {
    const motoristaId = await motoristaAtivoDoUsuario(usuarioId);
    if (ordem.motoristaId !== motoristaId) {
      throw new HttpError(403, "Esta ordem de coleta não está atribuída a você.");
    }
  }

  return atualizarEtapaColetaSvo(ordem.chamadoId, usuarioId, status, ordemId);
}

export async function concluirColetaSvo(chamadoId: string, usuarioId?: string) {
  return atualizarEtapaColetaSvo(chamadoId, usuarioId, "ENTREGUE_SVO");
}

export async function cancelarOrdemColetaSvo(ordemId: string, usuarioId: string) {
  const ordem = await prisma.ordemColetaSvo.findUnique({
    where: { id: ordemId },
    select: { chamadoId: true },
  });
  if (!ordem) throw new HttpError(404, "Ordem de coleta não encontrada.");
  return atualizarEtapaColetaSvo(ordem.chamadoId, usuarioId, "CANCELADA", ordemId);
}

async function atualizarEtapaColetaSvo(
  chamadoId: string,
  usuarioId: string | undefined,
  status: z.infer<typeof avancarEtapaSchema>["status"] | "CANCELADA",
  ordemId?: string,
) {
  return transacionarSvo(async (tx) => {
    const referencia = await tx.chamadoSvo.findUnique({
      where: { id: chamadoId },
      include: { ordemColeta: true },
    });
    if (!referencia) throw new HttpError(404, "Chamado não encontrado.");
    if (!referencia.ordemColeta)
      throw new HttpError(409, "Chamado não possui ordem de coleta emitida.");
    await bloquearRecursosSvo(
      tx,
      referencia.ordemColeta.veiculoId,
      referencia.ordemColeta.motoristaId,
      chamadoId,
    );
    const chamado = await tx.chamadoSvo.findUnique({
      where: { id: chamadoId },
      include: { ordemColeta: true },
    });

    if (!chamado) throw new HttpError(404, "Chamado não encontrado.");
    if (!chamado.ordemColeta) {
      throw new HttpError(409, "Chamado não possui ordem de coleta emitida.");
    }
    if (ordemId && chamado.ordemColeta.id !== ordemId) {
      throw new HttpError(404, "Ordem de coleta não encontrada.");
    }

    if (
      chamado.ordemColeta.veiculoId !== referencia.ordemColeta.veiculoId ||
      chamado.ordemColeta.motoristaId !== referencia.ordemColeta.motoristaId
    ) {
      throw new HttpError(409, "Alocação alterada durante a atualização. Tente novamente.");
    }

    if (
      diarioConfig().enabled &&
      (await tx.saidaOrdem.findUnique({ where: { ordemId: chamado.ordemColeta.id } }))
    ) {
      throw new HttpError(409, "Conclua a saída no diário de bordo ao retornar à base.");
    }

    const anterior = chamado.ordemColeta.status;
    const esperado = status === "CANCELADA" ? "AGUARDANDO_DESPACHO" : etapaAnterior[status];
    // Ordens legadas em andamento já têm saída registrada.
    if (anterior !== esperado && !(anterior === "EM_ANDAMENTO" && status === "NO_LOCAL")) {
      throw new HttpError(409, "Transição inválida para a etapa atual da coleta.");
    }

    if (status === "EM_DESLOCAMENTO") {
      if (!chamado.ordemColeta.veiculoId || !chamado.ordemColeta.motoristaId) {
        throw new HttpError(422, "A ordem precisa de viatura e motorista para despacho.");
      }
      const [veiculo, motorista] = await Promise.all([
        tx.veiculo.findUnique({ where: { id: chamado.ordemColeta.veiculoId } }),
        tx.motorista.findUnique({ where: { id: chamado.ordemColeta.motoristaId } }),
      ]);
      if (
        !veiculo?.ativo ||
        veiculo.tipoFrota !== "SVO" ||
        !["DISPONIVEL", "EM_VIAGEM"].includes(veiculo.status)
      ) {
        throw new HttpError(422, "Viatura SVO indisponível para despacho.");
      }
      if (
        !motorista?.ativo ||
        motorista.status !== "OCUPADO" ||
        motorista.validadeCnh < dataHojeUTC()
      ) {
        throw new HttpError(422, "Motorista indisponível ou CNH vencida para despacho.");
      }
      await tx.veiculo.update({ where: { id: veiculo.id }, data: { status: "EM_VIAGEM" } });
    }

    const agora = new Date();
    const entrega = status === "ENTREGUE_SVO";
    const encerramento = entrega || status === "CANCELADA";
    const ordem = await tx.ordemColetaSvo.update({
      where: { id: chamado.ordemColeta.id },
      data: {
        status,
        ...(status === "EM_DESLOCAMENTO" && { dataHoraSaida: agora }),
        ...(status === "NO_LOCAL" && { dataHoraChegadaLocal: agora }),
        ...(entrega && { dataHoraEntregaSvo: agora }),
      },
    });

    if (encerramento && ordem.veiculoId) {
      const ordensRestantesVeiculo = await tx.ordemColetaSvo.count({
        where: {
          veiculoId: ordem.veiculoId,
          status: { in: [...STATUS_ORDEM_ATIVA] },
        },
      });

      if (ordensRestantesVeiculo === 0) {
        const alteracao = await tx.veiculo.updateMany({
          where: { id: ordem.veiculoId, status: "EM_VIAGEM" },
          data: { status: "DESINFECCAO" },
        });
        if (alteracao.count > 0)
          await tx.desinfeccaoSvo.create({
            data: {
              veiculoId: ordem.veiculoId,
              responsavelId: usuarioId ?? null,
              status: "EM_ANDAMENTO",
            },
          });
      }
    }

    if (encerramento && ordem.motoristaId) {
      const ordensRestantesMotorista = await tx.ordemColetaSvo.count({
        where: {
          motoristaId: ordem.motoristaId,
          status: { in: [...STATUS_ORDEM_ATIVA] },
        },
      });

      if (ordensRestantesMotorista === 0) {
        await tx.motorista.updateMany({
          where: { id: ordem.motoristaId, ativo: true, status: "OCUPADO" },
          data: { status: "DISPONIVEL" },
        });
      }
    }

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao:
          status === "CANCELADA" ? "CANCELAR_ORDEM" : entrega ? "CONCLUIR_COLETA" : "AVANCAR_ETAPA",
        tabelaAfetada: "ordens_coleta_svo",
        registroId: ordem.id,
        dadosNovos: {
          chamadoId,
          veiculoId: ordem.veiculoId,
          status,
          statusAnterior: anterior,
          dataHoraEtapa: agora.toISOString(),
        },
      },
    });

    return ordem;
  });
}

export async function concluirDesinfeccaoSvo(veiculoId: string, usuarioId?: string) {
  const referenciaDesinfeccao = new Date();
  const atualizada = await executarConclusaoDesinfeccaoSvo(
    veiculoId,
    referenciaDesinfeccao,
    usuarioId,
  );
  await notificarViaturaSvoLiberada({
    veiculoId: atualizada.id,
    placa: atualizada.placa,
    modelo: atualizada.modelo,
    referenciaDesinfeccao: referenciaDesinfeccao.toISOString(),
  });
  return atualizada;
}

async function executarConclusaoDesinfeccaoSvo(
  veiculoId: string,
  dataHoraConclusao: Date,
  usuarioId?: string,
) {
  return transacionarSvo(async (tx) => {
    await bloquearRecursosSvo(tx, veiculoId);
    const veiculo = await tx.veiculo.findUnique({ where: { id: veiculoId } });
    if (!veiculo || veiculo.tipoFrota !== "SVO" || !veiculo.ativo) {
      throw new HttpError(404, "Viatura SVO não encontrada.");
    }
    if (veiculo.status !== "DESINFECCAO") {
      throw new HttpError(409, "Esta viatura não está aguardando desinfecção.");
    }

    const ordensAtivas = await tx.ordemColetaSvo.count({
      where: { veiculoId, status: { in: [...STATUS_ORDEM_ATIVA] } },
    });
    if (ordensAtivas > 0) throw new HttpError(409, "Viatura ainda possui coletas ativas.");

    await tx.desinfeccaoSvo.updateMany({
      where: { veiculoId, status: "EM_ANDAMENTO" },
      data: {
        status: "CONCLUIDA",
        dataHoraConclusao,
        responsavelId: usuarioId ?? null,
      },
    });

    const atualizada = await tx.veiculo.update({
      where: { id: veiculoId },
      data: { status: "DISPONIVEL" },
      select: {
        id: true,
        placa: true,
        modelo: true,
        status: true,
        capacidadeMaxima: true,
        ativo: true,
      },
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao: "CONCLUIR_DESINFECCAO",
        tabelaAfetada: "veiculos",
        registroId: veiculoId,
        dadosNovos: {
          placa: atualizada.placa,
          status: "DISPONIVEL",
        },
      },
    });

    return atualizada;
  });
}

export async function listarViaturasSvo() {
  const viaturas = await prisma.veiculo.findMany({
    where: { tipoFrota: "SVO", ativo: true },
    select: {
      id: true,
      placa: true,
      modelo: true,
      status: true,
      capacidadeMaxima: true,
      ativo: true,
      ordensColeta: {
        where: { status: { in: [...STATUS_ORDEM_ATIVA] } },
        select: {
          id: true,
          motorista: {
            select: {
              id: true,
              usuario: { select: { nome: true } },
            },
          },
        },
      },
    },
    orderBy: { placa: "asc" },
  });

  return viaturas.map(({ ordensColeta, ...viatura }) => {
    const primeiraOrdem = ordensColeta[0];
    return {
      ...viatura,
      ocupacaoAtual: ordensColeta.length,
      motoristaAtual: primeiraOrdem?.motorista
        ? {
            id: primeiraOrdem.motorista.id,
            nome: primeiraOrdem.motorista.usuario?.nome ?? null,
          }
        : null,
    };
  });
}

export async function listarMotoristasSvoDisponiveis() {
  const hoje = dataHojeUTC();
  return prisma.motorista.findMany({
    where: {
      ativo: true,
      validadeCnh: { gte: hoje },
      OR: [
        { status: "DISPONIVEL" },
        { ordensColeta: { some: { status: { in: [...STATUS_ORDEM_ATIVA] } } } },
      ],
    },
    select: {
      id: true,
      status: true,
      numeroCnh: true,
      categoriaCnh: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { cpf: "asc" },
  });
}

export const remanejarOrdemSchema = z
  .object({
    veiculoId: z.uuid("Selecione uma viatura válida.").optional(),
    motoristaId: z.uuid("Selecione um motorista válido.").optional(),
    motivo: z.string().trim().min(3, "Informe o motivo da troca (mínimo 3 caracteres).").max(500),
  })
  .strict()
  .refine((v) => v.veiculoId || v.motoristaId, "Informe o recurso de destino.");

export async function listarRemanejamentosSvo(ordemId: string) {
  if (!(await prisma.ordemColetaSvo.findUnique({ where: { id: ordemId } })))
    throw new HttpError(404, "Ordem de coleta não encontrada.");
  return prisma.auditoriaSistema.findMany({
    where: { tabelaAfetada: "ordens_coleta_svo", registroId: ordemId, acao: "REMANEJAR_ORDEM" },
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
}

export async function remanejarOrdemColetaSvo(
  ordemId: string,
  input: z.infer<typeof remanejarOrdemSchema>,
  usuarioId: string,
) {
  return transacionarSvo(async (tx) => {
    const referencia = await tx.ordemColetaSvo.findUnique({ where: { id: ordemId } });
    if (!referencia) throw new HttpError(404, "Ordem de coleta não encontrada.");
    const veiculoId = input.veiculoId ?? referencia.veiculoId;
    const motoristaId = input.motoristaId ?? referencia.motoristaId;
    if (!veiculoId || !motoristaId) throw new HttpError(422, "Informe viatura e condutor.");
    // Bloquear todos os recursos na mesma ordem global usada nos despachos.
    const chaves = [
      ...new Set(
        [
          `veiculo:${veiculoId}`,
          `motorista:${motoristaId}`,
          referencia.veiculoId && `veiculo:${referencia.veiculoId}`,
          referencia.motoristaId && `motorista:${referencia.motoristaId}`,
        ].filter((v): v is string => Boolean(v)),
      ),
    ].sort();
    for (const chave of chaves)
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
    await bloquearRecursosSvo(tx, veiculoId, motoristaId, referencia.chamadoId);
    const anterior = await tx.ordemColetaSvo.findUnique({
      where: { id: ordemId },
      include: { veiculo: true, motorista: { include: { usuario: true } } },
    });
    if (
      !anterior ||
      anterior.veiculoId !== referencia.veiculoId ||
      anterior.motoristaId !== referencia.motoristaId
    )
      throw new HttpError(409, "Alocação alterada por outra operação. Atualize os dados.");
    if (!["EM_DESLOCAMENTO", "NO_LOCAL"].includes(anterior.status))
      throw new HttpError(409, "Remanejamento permitido apenas em deslocamento ou no local.");
    if (veiculoId === anterior.veiculoId && motoristaId === anterior.motoristaId)
      throw new HttpError(422, "Selecione uma viatura ou condutor diferente.");
    const [veiculo, motorista, outras, viagem, desinfeccao] = await Promise.all([
      tx.veiculo.findUnique({ where: { id: veiculoId } }),
      tx.motorista.findUnique({ where: { id: motoristaId }, include: { usuario: true } }),
      tx.ordemColetaSvo.findMany({
        where: {
          id: { not: ordemId },
          status: { in: [...STATUS_ORDEM_ATIVA] },
          OR: [{ veiculoId }, { motoristaId }],
        },
      }),
      tx.solicitacaoViagem.findFirst({
        where: {
          status: { in: ["APROVADA", "EM_TRANSITO"] },
          OR: [{ veiculoAlocadoId: veiculoId }, { motoristaAlocadoId: motoristaId }],
        },
        select: { id: true },
      }),
      tx.desinfeccaoSvo.count({ where: { veiculoId, status: "EM_ANDAMENTO" } }),
    ]);
    if (!veiculo?.ativo || veiculo.tipoFrota !== "SVO")
      throw new HttpError(422, "Viatura deve pertencer à frota SVO ativa.");
    if (viagem) throw new HttpError(409, "Recurso alocado em outra viagem ativa.");
    if (desinfeccao || veiculo.status === "DESINFECCAO")
      throw new HttpError(409, "Viatura bloqueada para desinfecção.");
    if (!["DISPONIVEL", "EM_VIAGEM"].includes(veiculo.status))
      throw new HttpError(409, "Viatura indisponível ou em manutenção.");
    const naViatura = outras.filter((o) => o.veiculoId === veiculoId);
    if (naViatura.length >= veiculo.capacidadeMaxima)
      throw new HttpError(409, "Capacidade máxima da viatura atingida.");
    if (!motorista?.ativo || motorista.validadeCnh < dataHojeUTC())
      throw new HttpError(422, "Condutor inativo ou CNH vencida.");
    if (
      !["DISPONIVEL", "OCUPADO"].includes(motorista.status) ||
      (motorista.status === "OCUPADO" &&
        motoristaId !== anterior.motoristaId &&
        !naViatura.some((o) => o.motoristaId === motoristaId)) ||
      outras.some((o) => o.motoristaId === motoristaId && o.veiculoId !== veiculoId) ||
      naViatura.some((o) => o.motoristaId !== motoristaId)
    )
      throw new HttpError(
        409,
        "Condutor indisponível ou incompatível com as demais ordens ativas.",
      );
    const ordem = await tx.ordemColetaSvo.update({
      where: { id: ordemId },
      data: { veiculoId, motoristaId },
    });
    await tx.veiculo.update({ where: { id: veiculoId }, data: { status: "EM_VIAGEM" } });
    await tx.motorista.update({ where: { id: motoristaId }, data: { status: "OCUPADO" } });
    if (
      anterior.veiculoId &&
      anterior.veiculoId !== veiculoId &&
      !(await tx.ordemColetaSvo.count({
        where: { veiculoId: anterior.veiculoId, status: { in: [...STATUS_ORDEM_ATIVA] } },
      }))
    ) {
      const liberada = await tx.veiculo.updateMany({
        where: { id: anterior.veiculoId, status: "EM_VIAGEM" },
        data: { status: "DESINFECCAO" },
      });
      if (liberada.count)
        await tx.desinfeccaoSvo.create({
          data: { veiculoId: anterior.veiculoId, responsavelId: usuarioId, status: "EM_ANDAMENTO" },
        });
    }
    if (
      anterior.motoristaId &&
      anterior.motoristaId !== motoristaId &&
      !(await tx.ordemColetaSvo.count({
        where: { motoristaId: anterior.motoristaId, status: { in: [...STATUS_ORDEM_ATIVA] } },
      }))
    )
      await tx.motorista.updateMany({
        where: { id: anterior.motoristaId, ativo: true, status: "OCUPADO" },
        data: { status: "DISPONIVEL" },
      });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "REMANEJAR_ORDEM",
        tabelaAfetada: "ordens_coleta_svo",
        registroId: ordemId,
        dadosNovos: {
          motivo: input.motivo,
          status: anterior.status,
          anterior: {
            veiculoId: anterior.veiculoId,
            placa: anterior.veiculo?.placa,
            motoristaId: anterior.motoristaId,
            condutor: anterior.motorista?.usuario?.nome,
          },
          atual: {
            veiculoId,
            placa: veiculo.placa,
            motoristaId,
            condutor: motorista.usuario?.nome,
          },
        },
      },
    });
    return ordem;
  });
}
