import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import type { UsuarioAutenticado } from "../middleware/http_m";

// Fluxo interno das solicitações externas do SVO: triagem da atendente (S19FROTA-283)
// e decisão do gestor com conversão em ChamadoSvo (S19FROTA-285).
// Estados e histórico seguem o portal do solicitante (S19FROTA-281).

const TABELA = "solicitacoes_externas_svo";

export type EstadoSolicitacaoExterna =
  | "AGUARDANDO_TRIAGEM"
  | "AGUARDANDO_COMPLEMENTACAO"
  | "AGUARDANDO_GESTOR"
  | "APROVADA"
  | "RECUSADA";

// O painel interno usa DEVOLVIDA_PARA_COMPLEMENTACAO para o mesmo estado.
function statusPainel(estado: string | null) {
  return estado === "AGUARDANDO_COMPLEMENTACAO" ? "DEVOLVIDA_PARA_COMPLEMENTACAO" : estado;
}

const paginacao = {
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
};

export const filaTriagemSchema = z.object({
  estado: z.enum(["AGUARDANDO_TRIAGEM", "AGUARDANDO_COMPLEMENTACAO"]).default("AGUARDANDO_TRIAGEM"),
  ...paginacao,
});

export const filaGestorSchema = z.object(paginacao);

export const justificativaSchema = z
  .string({ error: "Descreva a justificativa." })
  .trim()
  .min(3, "Justificativa deve ter ao menos 3 caracteres.")
  .max(500, "Justificativa deve ter no máximo 500 caracteres.");

export const triagemExternaSchema = z
  .object({
    decisao: z.enum(["SOLICITAR_COMPLEMENTACAO", "RECUSAR", "ENCAMINHAR"], {
      error: "Escolha se deseja solicitar complementação, recusar ou encaminhar ao gestor.",
    }),
    justificativa: justificativaSchema.optional(),
  })
  .strict()
  .superRefine((valor, ctx) => {
    // No Zod 4 o superRefine roda mesmo com campos inválidos: conferir o tipo antes.
    if (typeof valor?.decisao !== "string" || valor.decisao === "ENCAMINHAR") return;
    if (typeof valor.justificativa !== "string") {
      ctx.addIssue({
        code: "custom",
        path: ["justificativa"],
        message:
          valor.decisao === "RECUSAR"
            ? "Justificativa obrigatória para recusa."
            : "Descreva o que o solicitante precisa complementar.",
      });
    }
  });

export const aprovarExternaSchema = z
  .object({ justificativa: justificativaSchema.optional() })
  .strict();
export const recusarExternaSchema = z.object({ justificativa: justificativaSchema }).strict();

export const chaveIdempotenciaSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.:-]{8,100}$/, "Chave de idempotência inválida.")
  .optional();

export const incluirHistorico = {
  historico: { orderBy: { criadoEm: "asc" as const } },
  chamadoSvo: { select: { id: true, numeroProtocolo: true } },
} satisfies Prisma.SolicitacaoExternaSvoInclude;

export type SolicitacaoComHistorico = Prisma.SolicitacaoExternaSvoGetPayload<{
  include: typeof incluirHistorico;
}>;

type Cliente = Prisma.TransactionClient | typeof prisma;

async function nomesUsuarios(cliente: Cliente, registros: SolicitacaoComHistorico[]) {
  const ids = new Set<string>();
  for (const registro of registros) {
    if (registro.atendenteTriagemId) ids.add(registro.atendenteTriagemId);
    if (registro.gestorDecisaoId) ids.add(registro.gestorDecisaoId);
    for (const item of registro.historico) if (item.autorId) ids.add(item.autorId);
  }
  if (ids.size === 0) return new Map<string, string>();
  const usuarios = await cliente.usuario.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, nome: true },
  });
  return new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));
}

function ultimoConteudo(registro: SolicitacaoComHistorico, tipos: string[]) {
  const item = [...registro.historico].reverse().find((evento) => tipos.includes(evento.tipo));
  return item?.conteudo ?? null;
}

// Visão interna (atendente e gestor) no formato que o painel do SVO consome.
export function serializarSolicitacaoInterna(
  registro: SolicitacaoComHistorico,
  nomes: Map<string, string>,
) {
  const pessoa = (id: string | null) => (id ? { id, nome: nomes.get(id) ?? null } : null);
  return {
    id: registro.id,
    protocolo: registro.protocolo,
    estado: registro.estado,
    status: statusPainel(registro.estado),
    nomeSolicitante: registro.contatoNome,
    contato: registro.contatoTelefone,
    contatoEmail: registro.contatoEmail,
    enderecoOcorrencia: registro.enderecoOcorrencia,
    descricao: registro.relatoOcorrencia,
    mensagemParaSolicitante: registro.mensagemParaSolicitante,
    relatoTriagem: ultimoConteudo(registro, ["ENCAMINHAMENTO"]),
    justificativa: ultimoConteudo(registro, ["RECUSA_TRIAGEM", "RECUSA_GESTOR"]),
    atendenteTriagem: pessoa(registro.atendenteTriagemId),
    gestorDecisao: pessoa(registro.gestorDecisaoId),
    chamadoSvoId: registro.chamadoSvoId,
    chamadoSvoProtocolo: registro.chamadoSvo?.numeroProtocolo ?? null,
    criadoEm: registro.criadoEm,
    triadaEm: registro.triadaEm,
    decididaEm: registro.decididaEm,
    atualizadoEm: registro.atualizadoEm,
    historico: registro.historico.map((item) => ({
      tipo: item.tipo,
      statusAnterior: statusPainel(item.estadoAnterior),
      statusNovo: statusPainel(item.estadoNovo),
      justificativa: item.conteudo,
      autorNome: item.autorId ? (nomes.get(item.autorId) ?? null) : null,
      criadoEm: item.criadoEm,
    })),
  };
}

export async function serializarLista(cliente: Cliente, registros: SolicitacaoComHistorico[]) {
  const nomes = await nomesUsuarios(cliente, registros);
  return registros.map((registro) => serializarSolicitacaoInterna(registro, nomes));
}

export async function listarSolicitacoesExternasInternas(
  where: Prisma.SolicitacaoExternaSvoWhereInput,
  orderBy: Prisma.SolicitacaoExternaSvoOrderByWithRelationInput[],
  page: number,
  pageSize: number,
) {
  const [registros, total] = await Promise.all([
    prisma.solicitacaoExternaSvo.findMany({
      where,
      include: incluirHistorico,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitacaoExternaSvo.count({ where }),
  ]);
  return {
    data: await serializarLista(prisma, registros),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// Fila da atendente: mais antigas primeiro.
export function listarFilaTriagemExterna(filtros: z.infer<typeof filaTriagemSchema>) {
  return listarSolicitacoesExternasInternas(
    { estado: filtros.estado },
    [{ criadoEm: "asc" }, { id: "asc" }],
    filtros.page,
    filtros.pageSize,
  );
}

// Fila do gestor: somente o que já foi triado e encaminhado.
export function listarFilaGestorExterna(filtros: z.infer<typeof filaGestorSchema>) {
  return listarSolicitacoesExternasInternas(
    { estado: "AGUARDANDO_GESTOR" },
    [{ triadaEm: "asc" }, { id: "asc" }],
    filtros.page,
    filtros.pageSize,
  );
}

export async function obterSolicitacaoExternaTriagem(id: string) {
  const registro = await prisma.solicitacaoExternaSvo.findUnique({
    where: { id },
    include: incluirHistorico,
  });
  if (!registro) throw new HttpError(404, "Solicitação externa não encontrada.");
  const [serializado] = await serializarLista(prisma, [registro]);
  return serializado;
}

export async function transacionarFluxoExterno<T>(
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(operacao, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034", "P2028"].includes(error.code)
    ) {
      throw new HttpError(
        409,
        "A solicitação foi atualizada por outro usuário. Atualize a página e tente novamente.",
      );
    }
    throw error;
  }
}

const REGRAS_TRIAGEM = {
  SOLICITAR_COMPLEMENTACAO: {
    de: ["AGUARDANDO_TRIAGEM"],
    para: "AGUARDANDO_COMPLEMENTACAO",
    tipo: "PEDIDO_COMPLEMENTO",
    acao: "TRIAGEM_COMPLEMENTAR",
    mensagem: "Complementação solicitada ao solicitante.",
  },
  RECUSAR: {
    de: ["AGUARDANDO_TRIAGEM", "AGUARDANDO_COMPLEMENTACAO"],
    para: "RECUSADA",
    tipo: "RECUSA_TRIAGEM",
    acao: "TRIAGEM_RECUSAR",
    mensagem: "Solicitação recusada na triagem.",
  },
  ENCAMINHAR: {
    de: ["AGUARDANDO_TRIAGEM"],
    para: "AGUARDANDO_GESTOR",
    tipo: "ENCAMINHAMENTO",
    acao: "TRIAGEM_ENCAMINHAR",
    mensagem: "Solicitação encaminhada ao gestor.",
  },
} as const satisfies Record<
  z.infer<typeof triagemExternaSchema>["decisao"],
  {
    de: readonly EstadoSolicitacaoExterna[];
    para: EstadoSolicitacaoExterna;
    tipo: string;
    acao: string;
    mensagem: string;
  }
>;

export async function triarSolicitacaoExterna(
  id: string,
  input: z.infer<typeof triagemExternaSchema>,
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
) {
  const regra = REGRAS_TRIAGEM[input.decisao];
  const justificativa = input.justificativa ?? null;

  return transacionarFluxoExterno(async (tx) => {
    const atual = await tx.solicitacaoExternaSvo.findUnique({
      where: { id },
      select: { estado: true, protocolo: true, solicitanteId: true },
    });
    if (!atual) throw new HttpError(404, "Solicitação externa não encontrada.");
    if (atual.solicitanteId === usuario.id) {
      throw new HttpError(403, "Você não pode triar uma solicitação aberta por você.");
    }
    if (!(regra.de as readonly string[]).includes(atual.estado)) {
      throw new HttpError(
        409,
        `A solicitação está ${atual.estado} e não aceita esta decisão de triagem.`,
      );
    }

    // Só o pedido de complementação vai para o portal; recusa e encaminhamento ficam internos.
    const complementar = input.decisao === "SOLICITAR_COMPLEMENTACAO";
    const resultado = await tx.solicitacaoExternaSvo.updateMany({
      where: { id, estado: atual.estado },
      data: {
        estado: regra.para,
        mensagemParaSolicitante: complementar ? justificativa : null,
        ...(complementar ? {} : { atendenteTriagemId: usuario.id, triadaEm: agora }),
      },
    });
    if (resultado.count === 0) {
      throw new HttpError(
        409,
        "A solicitação foi atualizada por outro usuário. Atualize a página e tente novamente.",
      );
    }

    await tx.solicitacaoExternaSvoHistorico.create({
      data: {
        solicitacaoId: id,
        tipo: regra.tipo,
        estadoAnterior: atual.estado,
        estadoNovo: regra.para,
        autorId: usuario.id,
        conteudo: justificativa,
        criadoEm: agora,
      },
    });
    // Sem texto livre na auditoria (LGPD); o conteúdo fica no histórico.
    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: regra.acao,
        tabelaAfetada: TABELA,
        registroId: id,
        dadosNovos: {
          protocolo: atual.protocolo,
          estadoAnterior: atual.estado,
          estadoNovo: regra.para,
        },
      },
    });

    const registro = await tx.solicitacaoExternaSvo.findUniqueOrThrow({
      where: { id },
      include: incluirHistorico,
    });
    const [dados] = await serializarLista(tx, [registro]);
    return { dados, mensagem: regra.mensagem };
  });
}

export async function decidirSolicitacaoExterna(
  id: string,
  decisao: "APROVAR" | "RECUSAR",
  justificativa: string | undefined,
  usuario: UsuarioAutenticado,
  chaveIdempotencia?: string,
  agora: Date = new Date(),
) {
  const estadoFinal: EstadoSolicitacaoExterna = decisao === "APROVAR" ? "APROVADA" : "RECUSADA";

  return transacionarFluxoExterno(async (tx) => {
    // Serializa decisões simultâneas sobre a mesma solicitação.
    await tx.$queryRaw`SELECT id FROM solicitacoes_externas_svo WHERE id = ${id}::uuid FOR UPDATE`;
    const atual = await tx.solicitacaoExternaSvo.findUnique({
      where: { id },
      include: incluirHistorico,
    });
    if (!atual) throw new HttpError(404, "Solicitação externa não encontrada.");

    // Reenvio da mesma decisão (mesma chave e mesmo gestor): devolve o resultado já gravado.
    if (
      chaveIdempotencia &&
      atual.chaveIdempotenciaDecisao === chaveIdempotencia &&
      atual.gestorDecisaoId === usuario.id &&
      atual.estado === estadoFinal
    ) {
      const [dados] = await serializarLista(tx, [atual]);
      return { dados, mensagem: "Decisão já registrada anteriormente." };
    }

    if (atual.estado === "AGUARDANDO_TRIAGEM" || atual.estado === "AGUARDANDO_COMPLEMENTACAO") {
      throw new HttpError(409, "A solicitação ainda não foi triada pela atendente do SVO.");
    }
    if (atual.estado !== "AGUARDANDO_GESTOR") {
      throw new HttpError(409, `A solicitação já foi decidida (${atual.estado}).`);
    }
    if (atual.atendenteTriagemId === usuario.id || atual.solicitanteId === usuario.id) {
      throw new HttpError(
        403,
        "A decisão precisa ser tomada por um gestor diferente de quem abriu ou triou a solicitação.",
      );
    }

    let chamadoSvoId: string | null = null;
    if (decisao === "APROVAR") {
      // Entra no fluxo operacional já aprovado na triagem e sem ordem de coleta (sem despacho
      // automático). criadoEm herda a abertura da solicitação para o SLA contar desde o pedido.
      const chamado = await tx.chamadoSvo.create({
        data: {
          numeroProtocolo: atual.protocolo,
          atendenteId: atual.atendenteTriagemId,
          enderecoOcorrencia: atual.enderecoOcorrencia,
          relatoOcorrencia: atual.relatoOcorrencia,
          statusTriagem: "APROVADO",
          origem: "EXTERNA",
          criadoEm: atual.criadoEm,
        },
        select: { id: true, numeroProtocolo: true },
      });
      chamadoSvoId = chamado.id;
      await tx.auditoriaSistema.create({
        data: {
          usuarioId: usuario.id,
          acao: "CRIAR",
          tabelaAfetada: "chamados_svo",
          registroId: chamado.id,
          dadosNovos: {
            numeroProtocolo: chamado.numeroProtocolo,
            statusTriagem: "APROVADO",
            origem: "EXTERNA",
            solicitacaoExternaId: id,
          },
        },
      });
    }

    // O portal mostra a mensagem padrão do estado; a justificativa fica no histórico interno.
    const resultado = await tx.solicitacaoExternaSvo.updateMany({
      where: { id, estado: "AGUARDANDO_GESTOR" },
      data: {
        estado: estadoFinal,
        mensagemParaSolicitante: null,
        gestorDecisaoId: usuario.id,
        decididaEm: agora,
        chaveIdempotenciaDecisao: chaveIdempotencia ?? null,
        ...(chamadoSvoId ? { chamadoSvoId } : {}),
      },
    });
    if (resultado.count === 0) {
      throw new HttpError(409, "A solicitação já foi decidida por outro gestor.");
    }

    await tx.solicitacaoExternaSvoHistorico.create({
      data: {
        solicitacaoId: id,
        tipo: decisao === "APROVAR" ? "APROVACAO" : "RECUSA_GESTOR",
        estadoAnterior: "AGUARDANDO_GESTOR",
        estadoNovo: estadoFinal,
        autorId: usuario.id,
        conteudo: justificativa ?? null,
        criadoEm: agora,
      },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: decisao === "APROVAR" ? "GESTOR_APROVAR" : "GESTOR_RECUSAR",
        tabelaAfetada: TABELA,
        registroId: id,
        dadosNovos: {
          protocolo: atual.protocolo,
          estadoAnterior: "AGUARDANDO_GESTOR",
          estadoNovo: estadoFinal,
          chamadoSvoId,
        },
      },
    });

    const registro = await tx.solicitacaoExternaSvo.findUniqueOrThrow({
      where: { id },
      include: incluirHistorico,
    });
    const [dados] = await serializarLista(tx, [registro]);
    return {
      dados,
      mensagem:
        decisao === "APROVAR"
          ? `Solicitação aprovada. Chamado SVO ${atual.protocolo} criado e aguardando ordem de coleta.`
          : "Solicitação recusada.",
    };
  });
}
