import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import type { UsuarioAutenticado } from "../middleware/http_m";
import {
  MENSAGEM_PUBLICA_POR_STATUS,
  validarTransicaoStatusSolicitacaoExterna,
  type StatusSolicitacaoExternaSvo,
} from "./solicitacao_externa_svo_s";

const TABELA = "solicitacoes_externas_svo";

const paginacao = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
};

export const filaTriagemSchema = z.object({
  estado: z.enum(["AGUARDANDO_TRIAGEM", "AGUARDANDO_COMPLEMENTACAO"]).default("AGUARDANDO_TRIAGEM"),
  ...paginacao,
});

export const justificativaSchema = z
  .string({ error: "Descreva a justificativa." })
  .trim()
  .min(5, "A justificativa deve ter ao menos 5 caracteres.")
  .max(500, "A justificativa deve ter no máximo 500 caracteres.");

export const triagemExternaSchema = z
  .object({
    decisao: z.enum(["SOLICITAR_COMPLEMENTACAO", "RECUSAR", "ENCAMINHAR"], {
      error: "Escolha se deseja solicitar complementação, recusar ou encaminhar ao gestor.",
    }),
    justificativa: justificativaSchema.optional(),
  })
  .strict()
  .superRefine((valor, ctx) => {
    if (valor.decisao !== "ENCAMINHAR" && !valor.justificativa) {
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

export const incluirHistorico = {
  historico: { orderBy: { criadoEm: "asc" as const } },
} satisfies Prisma.SolicitacaoExternaSvoInclude;

export type SolicitacaoComHistorico = Prisma.SolicitacaoExternaSvoGetPayload<{
  include: typeof incluirHistorico;
}>;

type Cliente = Prisma.TransactionClient | typeof prisma;

const TIPO_HISTORICO: Record<string, string> = {
  SOLICITACAO_CRIADA: "CRIACAO",
  SOLICITAR_COMPLEMENTACAO: "PEDIDO_COMPLEMENTO",
  COMPLEMENTACAO_ENVIADA: "COMPLEMENTO",
  ENCAMINHAR_GESTOR: "ENCAMINHAMENTO",
  RECUSAR_TRIAGEM: "RECUSA_TRIAGEM",
  APROVAR_GESTOR: "APROVACAO_GESTOR",
  RECUSAR_GESTOR: "RECUSA_GESTOR",
};

function statusPainel(status: string | null) {
  return status === "AGUARDANDO_COMPLEMENTACAO" ? "DEVOLVIDA_PARA_COMPLEMENTACAO" : status;
}

function conteudoHistorico(item: SolicitacaoComHistorico["historico"][number]) {
  if (item.observacaoInterna) return item.observacaoInterna;
  const prefixoComplementacao = "Complementação enviada: ";
  if (
    item.acao === "COMPLEMENTACAO_ENVIADA" &&
    item.mensagemPublica?.startsWith(prefixoComplementacao)
  ) {
    return item.mensagemPublica.slice(prefixoComplementacao.length);
  }
  return item.mensagemPublica;
}

async function nomesUsuarios(cliente: Cliente, registros: SolicitacaoComHistorico[]) {
  const ids = new Set<string>();
  for (const registro of registros) {
    if (registro.atendenteTriagemId) ids.add(registro.atendenteTriagemId);
    for (const item of registro.historico) ids.add(item.autorId);
  }
  if (ids.size === 0) return new Map<string, string>();
  const usuarios = await cliente.usuario.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, nome: true },
  });
  return new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));
}

export function serializarSolicitacaoInterna(
  registro: SolicitacaoComHistorico,
  nomes: Map<string, string>,
) {
  const status = statusPainel(registro.status);
  return {
    id: registro.id,
    protocolo: registro.protocolo,
    estado: registro.status,
    status,
    nomeSolicitante: registro.nomeContato,
    contato: registro.telefoneContato,
    contatoEmail: registro.contatoEmail,
    enderecoOcorrencia: registro.enderecoOcorrencia,
    descricao: registro.relatoOcorrencia,
    mensagemParaSolicitante:
      registro.status === "AGUARDANDO_COMPLEMENTACAO" ? registro.complementacaoSolicitada : null,
    relatoTriagem: registro.observacaoTriagem,
    justificativa: registro.motivoRecusa ?? registro.justificativaDecisao,
    atendenteTriagem: registro.atendenteTriagemId
      ? { id: registro.atendenteTriagemId, nome: nomes.get(registro.atendenteTriagemId) ?? null }
      : null,
    criadoEm: registro.criadoEm,
    triadaEm: registro.triadaEm,
    atualizadoEm: registro.atualizadoEm,
    historico: registro.historico.map((item) => ({
      tipo: TIPO_HISTORICO[item.acao] ?? item.acao,
      statusAnterior: statusPainel(item.statusAnterior),
      statusNovo: statusPainel(item.statusNovo),
      justificativa: conteudoHistorico(item),
      autorNome: nomes.get(item.autorId) ?? null,
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

export function listarFilaTriagemExterna(filtros: z.infer<typeof filaTriagemSchema>) {
  return listarSolicitacoesExternasInternas(
    { status: filtros.estado },
    [{ criadoEm: "asc" }, { id: "asc" }],
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

const REGRAS_TRIAGEM = {
  SOLICITAR_COMPLEMENTACAO: {
    para: "AGUARDANDO_COMPLEMENTACAO",
    acao: "SOLICITAR_COMPLEMENTACAO",
    mensagem: "Complementação solicitada ao solicitante.",
  },
  RECUSAR: {
    para: "RECUSADA",
    acao: "RECUSAR_TRIAGEM",
    mensagem: "Solicitação recusada na triagem.",
  },
  ENCAMINHAR: {
    para: "AGUARDANDO_GESTOR",
    acao: "ENCAMINHAR_GESTOR",
    mensagem: "Solicitação encaminhada ao gestor.",
  },
} as const satisfies Record<
  z.infer<typeof triagemExternaSchema>["decisao"],
  { para: StatusSolicitacaoExternaSvo; acao: string; mensagem: string }
>;

export async function triarSolicitacaoExterna(
  id: string,
  input: z.infer<typeof triagemExternaSchema>,
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
) {
  const regra = REGRAS_TRIAGEM[input.decisao];
  const justificativa = input.justificativa ?? null;

  return prisma.$transaction(async (tx) => {
    const atual = await tx.solicitacaoExternaSvo.findUnique({
      where: { id },
      select: { status: true, protocolo: true, solicitanteId: true, versao: true },
    });
    if (!atual) throw new HttpError(404, "Solicitação externa não encontrada.");
    if (atual.solicitanteId === usuario.id) {
      throw new HttpError(403, "Você não pode triar uma solicitação aberta por você.");
    }

    const statusAtual = atual.status as StatusSolicitacaoExternaSvo;
    const { perfilResponsavel } = validarTransicaoStatusSolicitacaoExterna(
      statusAtual,
      regra.para,
      usuario.perfis,
    );
    const complemento = input.decisao === "SOLICITAR_COMPLEMENTACAO";
    const recusa = input.decisao === "RECUSAR";
    const encaminhamento = input.decisao === "ENCAMINHAR";
    const mensagemPublica = complemento
      ? `Complementação solicitada: ${justificativa}`
      : recusa
        ? MENSAGEM_PUBLICA_POR_STATUS.RECUSADA
        : MENSAGEM_PUBLICA_POR_STATUS.AGUARDANDO_GESTOR;

    const resultado = await tx.solicitacaoExternaSvo.updateMany({
      where: { id, status: statusAtual, versao: atual.versao },
      data: {
        status: regra.para,
        versao: { increment: 1 },
        atualizadoEm: agora,
        atendenteTriagemId: usuario.id,
        triadaEm: agora,
        ...(complemento ? { complementacaoSolicitada: justificativa } : {}),
        ...(recusa ? { motivoRecusa: justificativa } : {}),
        ...(encaminhamento && justificativa ? { observacaoTriagem: justificativa } : {}),
      },
    });
    if (resultado.count !== 1) {
      throw new HttpError(
        409,
        "A solicitação foi atualizada por outro usuário. Atualize a página e tente novamente.",
      );
    }

    await tx.solicitacaoExternaSvoHistorico.create({
      data: {
        solicitacaoExternaId: id,
        autorId: usuario.id,
        perfilAutor: perfilResponsavel,
        acao: regra.acao,
        statusAnterior: statusAtual,
        statusNovo: regra.para,
        mensagemPublica,
        observacaoInterna: justificativa,
        criadoEm: agora,
      },
    });
    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: regra.acao,
        tabelaAfetada: TABELA,
        registroId: id,
        dadosNovos: {
          protocolo: atual.protocolo,
          estadoAnterior: statusAtual,
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
