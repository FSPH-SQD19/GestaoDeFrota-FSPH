import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";

export const STATUS_ORDEM_ATIVA = ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"] as const;
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
      error: "Decisão deve ser APROVAR ou RECUSAR.",
    }),
    justificativa: z
      .string({ error: "Justificativa deve ser texto." })
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
      .string({ error: "Declaração de óbito deve ser texto." })
      .trim()
      .max(50, "Declaração de óbito deve ter no máximo 50 caracteres.")
      .optional(),
  })
  .strict();

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
        OR: [{ statusTriagem: "RECUSADO" }, { ordemColeta: { is: { status: "CONCLUIDA" } } }],
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
  ] = await Promise.all([
    prisma.chamadoSvo.count(),
    prisma.chamadoSvo.count({ where: { statusTriagem: "EM_ANALISE" } }),
    prisma.chamadoSvo.count({
      where: { statusTriagem: "APROVADO", ordemColeta: { is: null } },
    }),
    prisma.chamadoSvo.count({ where: { statusTriagem: "APROVADO" } }),
    prisma.chamadoSvo.count({ where: { statusTriagem: "RECUSADO" } }),
    prisma.ordemColetaSvo.count({ where: { status: { in: [...STATUS_ORDEM_ATIVA] } } }),
    prisma.veiculo.count({ where: { tipoFrota: "SVO", ativo: true, status: "DISPONIVEL" } }),
    prisma.veiculo.count({ where: { tipoFrota: "SVO", ativo: true } }),
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

    const motoristaJaNaViatura =
      veiculo.status === "EM_VIAGEM" &&
      ordensAtivasVeiculo.some((ordem) => ordem.motoristaId === motorista.id);

    if (
      motorista.status !== "DISPONIVEL" &&
      !(motorista.status === "OCUPADO" && motoristaJaNaViatura)
    ) {
      throw new HttpError(422, "Motorista indisponível ou alocado em outra operação.");
    }

    if (motorista.validadeCnh < dataHojeUTC()) {
      throw new HttpError(422, "CNH do motorista vencida.");
    }

    const ordem = await tx.ordemColetaSvo.create({
      data: {
        chamadoId,
        veiculoId: veiculo.id,
        motoristaId: motorista.id,
        numeroDeclaracaoObito: input.numeroDeclaracaoObito || undefined,
        status: "EM_ANDAMENTO",
        dataHoraSaida: new Date(),
      },
    });

    await tx.veiculo.update({ where: { id: veiculo.id }, data: { status: "EM_VIAGEM" } });
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

export async function concluirColetaSvo(chamadoId: string, usuarioId?: string) {
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
    if (chamado.ordemColeta.status === "CONCLUIDA") {
      throw new HttpError(409, "Ordem de coleta já foi concluída.");
    }

    const ordem = await tx.ordemColetaSvo.update({
      where: { id: chamado.ordemColeta.id },
      data: { status: "CONCLUIDA" },
    });

    if (ordem.veiculoId) {
      const ordensRestantesVeiculo = await tx.ordemColetaSvo.count({
        where: {
          veiculoId: ordem.veiculoId,
          status: { in: [...STATUS_ORDEM_ATIVA] },
        },
      });

      if (ordensRestantesVeiculo === 0) {
        await tx.veiculo.updateMany({
          where: { id: ordem.veiculoId, status: "EM_VIAGEM" },
          data: { status: "DESINFECCAO" },
        });
        await tx.desinfeccaoSvo.create({
          data: {
            veiculoId: ordem.veiculoId,
            responsavelId: usuarioId ?? null,
            status: "EM_ANDAMENTO",
          },
        });
      }
    }

    if (ordem.motoristaId) {
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
        acao: "CONCLUIR_COLETA",
        tabelaAfetada: "ordens_coleta_svo",
        registroId: ordem.id,
        dadosNovos: {
          chamadoId,
          veiculoId: ordem.veiculoId,
          status: "CONCLUIDA",
        },
      },
    });

    return ordem;
  });
}

export async function concluirDesinfeccaoSvo(veiculoId: string, usuarioId?: string) {
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
        dataHoraConclusao: new Date(),
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
