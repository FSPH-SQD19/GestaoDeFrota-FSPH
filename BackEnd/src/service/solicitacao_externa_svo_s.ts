import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import type { UsuarioAutenticado } from "../middleware/http_m";
import { sanitizarLgpd } from "./auditoria_s";
import { normalizarTelefone } from "./telefone_s";

export const PREFIXO_PROTOCOLO_SVO_EXTERNO = "SVOE";
const FUSO_PROTOCOLO = "America/Maceio";
export const TABELA_AUDITORIA_SOLICITACAO_EXTERNA_SVO = "solicitacoes_externas_svo";

export const STATUS_SOLICITACAO_EXTERNA_SVO = [
  "AGUARDANDO_TRIAGEM",
  "AGUARDANDO_COMPLEMENTACAO",
  "AGUARDANDO_GESTOR",
  "APROVADA",
  "RECUSADA",
] as const;

export type StatusSolicitacaoExternaSvo = (typeof STATUS_SOLICITACAO_EXTERNA_SVO)[number];

export const TIPOS_SOLICITANTE_EXTERNO_SVO = [
  "FAMILIAR",
  "HOSPITAL_UPA",
  "SAMU_BOMBEIROS",
  "AUTORIDADE_POLICIAL",
  "INSTITUICAO_LONGA_PERMANENCIA",
  "OUTRO",
] as const;

export type TipoSolicitanteExternoSvo = (typeof TIPOS_SOLICITANTE_EXTERNO_SVO)[number];

export const ACOES_HISTORICO_SOLICITACAO_EXTERNA_SVO = [
  "SOLICITACAO_CRIADA",
  "SOLICITAR_COMPLEMENTACAO",
  "COMPLEMENTACAO_ENVIADA",
  "ENCAMINHAR_GESTOR",
  "RECUSAR_TRIAGEM",
  "APROVAR_GESTOR",
  "RECUSAR_GESTOR",
] as const;

export type AcaoHistoricoSolicitacaoExternaSvo =
  (typeof ACOES_HISTORICO_SOLICITACAO_EXTERNA_SVO)[number];

export const TRANSICOES_VALIDAS_SOLICITACAO_EXTERNA_SVO: Readonly<
  Record<StatusSolicitacaoExternaSvo, readonly StatusSolicitacaoExternaSvo[]>
> = {
  AGUARDANDO_TRIAGEM: ["AGUARDANDO_COMPLEMENTACAO", "AGUARDANDO_GESTOR", "RECUSADA"],
  AGUARDANDO_COMPLEMENTACAO: ["AGUARDANDO_TRIAGEM", "RECUSADA"],
  AGUARDANDO_GESTOR: ["APROVADA", "RECUSADA"],
  APROVADA: [],
  RECUSADA: [],
};

export const MENSAGEM_PUBLICA_POR_STATUS: Readonly<Record<StatusSolicitacaoExternaSvo, string>> = {
  AGUARDANDO_TRIAGEM: "Solicitação recebida e aguardando análise da equipe de triagem do SVO.",
  AGUARDANDO_COMPLEMENTACAO:
    "A equipe de triagem solicitou informações complementares para prosseguir com a análise.",
  AGUARDANDO_GESTOR:
    "Triagem concluída pela equipe do SVO. Solicitação encaminhada para deliberação da gestão.",
  APROVADA:
    "Solicitação aprovada pela gestão e integrada à central operacional do SVO para atendimento.",
  RECUSADA:
    "Solicitação não autorizada. Confira o motivo informado no acompanhamento do protocolo.",
};

export function obterTransicoesPermitidasSolicitacaoExterna(
  statusAtual: StatusSolicitacaoExternaSvo,
): readonly StatusSolicitacaoExternaSvo[] {
  return TRANSICOES_VALIDAS_SOLICITACAO_EXTERNA_SVO[statusAtual] ?? [];
}

export function podeTransicionarSolicitacaoExterna(
  statusAtual: StatusSolicitacaoExternaSvo,
  statusNovo: StatusSolicitacaoExternaSvo,
): boolean {
  return obterTransicoesPermitidasSolicitacaoExterna(statusAtual).includes(statusNovo);
}

export function validarTransicaoStatusSolicitacaoExterna(
  statusAtual: StatusSolicitacaoExternaSvo,
  statusNovo: StatusSolicitacaoExternaSvo,
  perfisAutor: readonly string[],
): { acaoHistorico: AcaoHistoricoSolicitacaoExternaSvo; perfilResponsavel: string } {
  if (statusAtual === "APROVADA" || statusAtual === "RECUSADA") {
    throw new HttpError(
      409,
      `A solicitação externa já se encontra encerrada com status ${statusAtual}.`,
    );
  }

  if (!podeTransicionarSolicitacaoExterna(statusAtual, statusNovo)) {
    throw new HttpError(409, `Transição de status inválida de ${statusAtual} para ${statusNovo}.`);
  }

  const isExterno = perfisAutor.includes("EXTERNO");
  const isAtendenteSvo = perfisAutor.includes("SVO") || perfisAutor.includes("ADMIN");
  const isGestor = perfisAutor.includes("GESTOR") || perfisAutor.includes("ADMIN");

  if (statusAtual === "AGUARDANDO_COMPLEMENTACAO" && statusNovo === "AGUARDANDO_TRIAGEM") {
    if (!isExterno) {
      throw new HttpError(
        403,
        "Apenas o solicitante externo pode enviar a complementação solicitada.",
      );
    }
    return { acaoHistorico: "COMPLEMENTACAO_ENVIADA", perfilResponsavel: "EXTERNO" };
  }

  if (statusAtual === "AGUARDANDO_TRIAGEM" || statusAtual === "AGUARDANDO_COMPLEMENTACAO") {
    if (isExterno || !isAtendenteSvo) {
      throw new HttpError(
        403,
        "Apenas a equipe de triagem do SVO pode avaliar ou encaminhar solicitações nesta etapa.",
      );
    }
    const perfilResponsavel = perfisAutor.includes("SVO") ? "SVO" : "ADMIN";
    if (statusNovo === "AGUARDANDO_COMPLEMENTACAO") {
      return { acaoHistorico: "SOLICITAR_COMPLEMENTACAO", perfilResponsavel };
    }
    if (statusNovo === "AGUARDANDO_GESTOR") {
      return { acaoHistorico: "ENCAMINHAR_GESTOR", perfilResponsavel };
    }
    return { acaoHistorico: "RECUSAR_TRIAGEM", perfilResponsavel };
  }

  if (statusAtual === "AGUARDANDO_GESTOR") {
    if (isExterno || !isGestor) {
      throw new HttpError(
        403,
        "Apenas o gestor pode aprovar ou recusar solicitações externas já triadas.",
      );
    }
    const perfilResponsavel = perfisAutor.includes("GESTOR") ? "GESTOR" : "ADMIN";
    return {
      acaoHistorico: statusNovo === "APROVADA" ? "APROVAR_GESTOR" : "RECUSAR_GESTOR",
      perfilResponsavel,
    };
  }

  throw new HttpError(409, `Transição de status inválida de ${statusAtual} para ${statusNovo}.`);
}

export async function gerarProtocoloSolicitacaoExternaSvo(
  tx: Prisma.TransactionClient,
  agora: Date = new Date(),
): Promise<string> {
  const ano = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO_PROTOCOLO, year: "numeric" }).format(agora),
  );
  const [contador] = await tx.$queryRaw<Array<{ ultimo_valor: number }>>`
    INSERT INTO "contadores_protocolo" ("prefixo", "ano", "ultimo_valor")
    VALUES (${PREFIXO_PROTOCOLO_SVO_EXTERNO}, ${ano}, 1)
    ON CONFLICT ("prefixo", "ano")
    DO UPDATE SET "ultimo_valor" = "contadores_protocolo"."ultimo_valor" + 1
    RETURNING "ultimo_valor"
  `;
  return `${PREFIXO_PROTOCOLO_SVO_EXTERNO}-${ano}-${String(Number(contador.ultimo_valor)).padStart(4, "0")}`;
}

export const criarSolicitacaoExternaSvoSchema = z
  .object({
    nomeContato: z
      .string({ error: "Informe o nome do responsável pelo contato." })
      .trim()
      .min(2, "O nome do contato deve ter ao menos 2 caracteres.")
      .max(150, "O nome do contato deve ter no máximo 150 caracteres."),
    telefoneContato: z
      .string({ error: "Informe um telefone de contato válido." })
      .trim()
      .min(8, "Informe um telefone válido com DDD.")
      .max(20, "Use no máximo 20 caracteres no telefone."),
    tipoSolicitante: z
      .enum(TIPOS_SOLICITANTE_EXTERNO_SVO, {
        error: "Selecione um tipo de solicitante válido.",
      })
      .default("FAMILIAR"),
    instituicaoSolicitante: z
      .string()
      .trim()
      .min(2, "O nome da instituição deve ter ao menos 2 caracteres.")
      .max(150, "O nome da instituição deve ter no máximo 150 caracteres.")
      .optional(),
    nomeFalecido: z
      .string({ error: "Informe a identificação do falecido." })
      .trim()
      .min(2, "O nome do falecido deve ter ao menos 2 caracteres.")
      .max(150, "O nome do falecido deve ter no máximo 150 caracteres."),
    enderecoOcorrencia: z
      .string({ error: "Informe o endereço da ocorrência." })
      .trim()
      .min(5, "O endereço da ocorrência deve ter ao menos 5 caracteres.")
      .max(300, "O endereço da ocorrência deve ter no máximo 300 caracteres."),
    municipioOcorrencia: z
      .string()
      .trim()
      .min(2, "O município deve ter ao menos 2 caracteres.")
      .max(100, "O município deve ter no máximo 100 caracteres.")
      .optional(),
    pontoReferencia: z
      .string()
      .trim()
      .max(200, "O ponto de referência deve ter no máximo 200 caracteres.")
      .optional(),
    relatoOcorrencia: z
      .string({ error: "Informe o relato preliminar para triagem." })
      .trim()
      .min(10, "O relato preliminar deve ter ao menos 10 caracteres.")
      .max(1000, "O relato preliminar deve ter no máximo 1000 caracteres."),
    chaveIdempotencia: z
      .string()
      .trim()
      .min(8, "A chave de idempotência deve ter ao menos 8 caracteres.")
      .max(100, "A chave de idempotência deve ter no máximo 100 caracteres.")
      .optional(),
  })
  .strict();

export type CriarSolicitacaoExternaSvoInput = z.infer<typeof criarSolicitacaoExternaSvoSchema>;

export const transicaoSolicitacaoExternaSvoSchema = z
  .object({
    solicitacaoId: z.uuid("Identificador da solicitação inválido."),
    statusNovo: z.enum(STATUS_SOLICITACAO_EXTERNA_SVO, {
      error: "Informe um status de destino válido.",
    }),
    versaoEsperada: z.number().int().min(0).optional(),
    complementacaoSolicitada: z.string().trim().min(5).max(500).optional(),
    complementacaoEnviada: z.string().trim().min(5).max(1000).optional(),
    observacaoTriagem: z.string().trim().min(3).max(500).optional(),
    justificativaDecisao: z.string().trim().min(3).max(500).optional(),
    motivoRecusa: z.string().trim().min(5).max(500).optional(),
    chamadoSvoId: z.uuid("Identificador de chamado SVO inválido.").optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.statusNovo === "AGUARDANDO_COMPLEMENTACAO" && !val.complementacaoSolicitada) {
      ctx.addIssue({
        code: "custom",
        path: ["complementacaoSolicitada"],
        message: "Descreva quais informações precisam ser complementadas pelo solicitante.",
      });
    }
    if (val.statusNovo === "RECUSADA" && !val.motivoRecusa) {
      ctx.addIssue({
        code: "custom",
        path: ["motivoRecusa"],
        message: "Informe o motivo da recusa da solicitação.",
      });
    }
  });

export type TransicaoSolicitacaoExternaSvoInput = z.infer<
  typeof transicaoSolicitacaoExternaSvoSchema
>;

const incluirRelacoesSolicitacaoExterna = {
  solicitante: {
    select: { id: true, nome: true, email: true, telefone: true },
  },
  atendenteTriagem: {
    select: { id: true, nome: true },
  },
  gestorDecisao: {
    select: { id: true, nome: true },
  },
  chamadoSvo: {
    select: { id: true, numeroProtocolo: true, statusTriagem: true },
  },
  historico: {
    orderBy: { criadoEm: "asc" as const },
  },
} satisfies Prisma.SolicitacaoExternaSvoInclude;

export type SolicitacaoExternaSvoCompleta = Prisma.SolicitacaoExternaSvoGetPayload<{
  include: typeof incluirRelacoesSolicitacaoExterna;
}>;

export function serializarSolicitacaoExternaPublica(registro: SolicitacaoExternaSvoCompleta) {
  const status = registro.status as StatusSolicitacaoExternaSvo;
  return {
    id: registro.id,
    protocolo: registro.protocolo,
    status,
    mensagemStatus:
      MENSAGEM_PUBLICA_POR_STATUS[status] ?? MENSAGEM_PUBLICA_POR_STATUS.AGUARDANDO_TRIAGEM,
    nomeContato: registro.nomeContato,
    telefoneContato: registro.telefoneContato,
    tipoSolicitante: registro.tipoSolicitante,
    instituicaoSolicitante: registro.instituicaoSolicitante,
    nomeFalecido: registro.nomeFalecido,
    enderecoOcorrencia: registro.enderecoOcorrencia,
    municipioOcorrencia: registro.municipioOcorrencia,
    pontoReferencia: registro.pontoReferencia,
    relatoOcorrencia: registro.relatoOcorrencia,
    complementacaoSolicitada: registro.complementacaoSolicitada,
    complementacaoEnviada: registro.complementacaoEnviada,
    motivoRecusa: registro.motivoRecusa,
    protocoloChamadoSvo: registro.chamadoSvo?.numeroProtocolo ?? null,
    versao: registro.versao,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
    historico: registro.historico.map((item) => ({
      id: item.id,
      acao: item.acao,
      statusAnterior: item.statusAnterior,
      statusNovo: item.statusNovo,
      mensagemPublica: item.mensagemPublica,
      criadoEm: item.criadoEm,
    })),
  };
}

export function serializarSolicitacaoExternaInterna(registro: SolicitacaoExternaSvoCompleta) {
  return {
    ...serializarSolicitacaoExternaPublica(registro),
    solicitante: registro.solicitante,
    atendenteTriagem: registro.atendenteTriagem,
    triadaEm: registro.triadaEm,
    observacaoTriagem: registro.observacaoTriagem,
    gestorDecisao: registro.gestorDecisao,
    decididaEm: registro.decididaEm,
    justificativaDecisao: registro.justificativaDecisao,
    chamadoSvoId: registro.chamadoSvoId,
    chamadoSvo: registro.chamadoSvo,
    historico: registro.historico.map((item) => ({
      id: item.id,
      autorId: item.autorId,
      perfilAutor: item.perfilAutor,
      acao: item.acao,
      statusAnterior: item.statusAnterior,
      statusNovo: item.statusNovo,
      mensagemPublica: item.mensagemPublica,
      observacaoInterna: item.observacaoInterna,
      criadoEm: item.criadoEm,
    })),
  };
}

export async function criarSolicitacaoExternaSvoModelada(
  rawInput: unknown,
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
) {
  if (!usuario?.id) {
    throw new HttpError(401, "Entre no sistema para continuar.");
  }

  const parsed = criarSolicitacaoExternaSvoSchema.parse(rawInput);
  const telefoneNormalizado = normalizarTelefone(parsed.telefoneContato);
  if (!telefoneNormalizado) {
    throw new HttpError(400, "Informe um telefone de contato válido.", [
      { campo: "telefoneContato", mensagem: "Informe um telefone de contato válido." },
    ]);
  }

  if (parsed.chaveIdempotencia) {
    const existente = await prisma.solicitacaoExternaSvo.findUnique({
      where: { chaveIdempotencia: parsed.chaveIdempotencia },
      include: incluirRelacoesSolicitacaoExterna,
    });
    if (existente) {
      if (existente.solicitanteId !== usuario.id) {
        throw new HttpError(409, "Chave de idempotência já utilizada em outra solicitação.");
      }
      return {
        criadaAgora: false,
        solicitacao: serializarSolicitacaoExternaPublica(existente),
      };
    }
  }

  const perfilAutor = usuario.perfis.includes("EXTERNO")
    ? "EXTERNO"
    : (usuario.perfis[0] ?? "EXTERNO");

  const criada = await prisma.$transaction(async (tx) => {
    const protocolo = await gerarProtocoloSolicitacaoExternaSvo(tx, agora);

    const registro = await tx.solicitacaoExternaSvo.create({
      data: {
        protocolo,
        solicitanteId: usuario.id,
        nomeContato: parsed.nomeContato,
        telefoneContato: telefoneNormalizado,
        tipoSolicitante: parsed.tipoSolicitante,
        instituicaoSolicitante: parsed.instituicaoSolicitante ?? null,
        nomeFalecido: parsed.nomeFalecido,
        enderecoOcorrencia: parsed.enderecoOcorrencia,
        municipioOcorrencia: parsed.municipioOcorrencia ?? null,
        pontoReferencia: parsed.pontoReferencia ?? null,
        relatoOcorrencia: parsed.relatoOcorrencia,
        status: "AGUARDANDO_TRIAGEM",
        chaveIdempotencia: parsed.chaveIdempotencia ?? null,
        criadoEm: agora,
        atualizadoEm: agora,
        historico: {
          create: {
            autorId: usuario.id,
            perfilAutor,
            acao: "SOLICITACAO_CRIADA",
            statusAnterior: null,
            statusNovo: "AGUARDANDO_TRIAGEM",
            mensagemPublica: MENSAGEM_PUBLICA_POR_STATUS.AGUARDANDO_TRIAGEM,
            observacaoInterna: null,
            criadoEm: agora,
          },
        },
      },
      include: incluirRelacoesSolicitacaoExterna,
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: "CRIAR",
        tabelaAfetada: TABELA_AUDITORIA_SOLICITACAO_EXTERNA_SVO,
        registroId: registro.id,
        dadosNovos: sanitizarLgpd({
          protocolo: registro.protocolo,
          status: registro.status,
          tipoSolicitante: registro.tipoSolicitante,
          instituicaoSolicitante: registro.instituicaoSolicitante,
          municipioOcorrencia: registro.municipioOcorrencia,
        }) as Prisma.InputJsonValue,
      },
    });

    return registro;
  });

  return {
    criadaAgora: true,
    solicitacao: serializarSolicitacaoExternaPublica(criada),
  };
}

export async function transicionarSolicitacaoExternaSvo(
  rawInput: unknown,
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
) {
  if (!usuario?.id) {
    throw new HttpError(401, "Entre no sistema para continuar.");
  }

  const parsed = transicaoSolicitacaoExternaSvoSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const atual = await tx.solicitacaoExternaSvo.findUnique({
      where: { id: parsed.solicitacaoId },
      include: incluirRelacoesSolicitacaoExterna,
    });

    if (!atual) {
      throw new HttpError(404, "Solicitação externa SVO não encontrada.");
    }

    if (usuario.perfis.includes("EXTERNO") && atual.solicitanteId !== usuario.id) {
      throw new HttpError(403, "Você não tem permissão para acessar ou alterar esta solicitação.");
    }

    if (parsed.versaoEsperada !== undefined && atual.versao !== parsed.versaoEsperada) {
      throw new HttpError(
        409,
        "A solicitação foi atualizada por outro usuário. Recarregue os dados e tente novamente.",
      );
    }

    const statusAtual = atual.status as StatusSolicitacaoExternaSvo;
    const { acaoHistorico, perfilResponsavel } = validarTransicaoStatusSolicitacaoExterna(
      statusAtual,
      parsed.statusNovo,
      usuario.perfis,
    );

    if (
      statusAtual === "AGUARDANDO_COMPLEMENTACAO" &&
      parsed.statusNovo === "AGUARDANDO_TRIAGEM" &&
      !parsed.complementacaoEnviada
    ) {
      throw new HttpError(400, "Informe os dados complementares solicitados pela triagem.", [
        {
          campo: "complementacaoEnviada",
          mensagem: "Informe os dados complementares solicitados pela triagem.",
        },
      ]);
    }

    if (parsed.statusNovo === "APROVADA" && atual.chamadoSvoId) {
      throw new HttpError(409, "Esta solicitação externa já possui um chamado SVO vinculado.");
    }

    const mensagemPublica =
      parsed.statusNovo === "AGUARDANDO_COMPLEMENTACAO"
        ? `Complementação solicitada: ${parsed.complementacaoSolicitada}`
        : parsed.statusNovo === "RECUSADA"
          ? `Solicitação recusada: ${parsed.motivoRecusa}`
          : MENSAGEM_PUBLICA_POR_STATUS[parsed.statusNovo];

    const observacaoInterna = parsed.observacaoTriagem ?? parsed.justificativaDecisao ?? null;

    const atualizados = await tx.solicitacaoExternaSvo.updateMany({
      where: {
        id: atual.id,
        status: statusAtual,
        versao: atual.versao,
      },
      data: {
        status: parsed.statusNovo,
        versao: { increment: 1 },
        atualizadoEm: agora,
        ...(parsed.complementacaoSolicitada !== undefined
          ? { complementacaoSolicitada: parsed.complementacaoSolicitada }
          : {}),
        ...(parsed.complementacaoEnviada !== undefined
          ? { complementacaoEnviada: parsed.complementacaoEnviada }
          : {}),
        ...(acaoHistorico === "SOLICITAR_COMPLEMENTACAO" ||
        acaoHistorico === "ENCAMINHAR_GESTOR" ||
        acaoHistorico === "RECUSAR_TRIAGEM"
          ? {
              atendenteTriagemId: usuario.id,
              triadaEm: agora,
              ...(parsed.observacaoTriagem !== undefined
                ? { observacaoTriagem: parsed.observacaoTriagem }
                : {}),
            }
          : {}),
        ...(acaoHistorico === "APROVAR_GESTOR" || acaoHistorico === "RECUSAR_GESTOR"
          ? {
              gestorDecisaoId: usuario.id,
              decididaEm: agora,
              ...(parsed.justificativaDecisao !== undefined
                ? { justificativaDecisao: parsed.justificativaDecisao }
                : {}),
            }
          : {}),
        ...(parsed.motivoRecusa !== undefined ? { motivoRecusa: parsed.motivoRecusa } : {}),
        ...(parsed.chamadoSvoId !== undefined ? { chamadoSvoId: parsed.chamadoSvoId } : {}),
      },
    });

    if (atualizados.count !== 1) {
      throw new HttpError(
        409,
        "Conflito de concorrência ao atualizar a solicitação externa. Tente novamente.",
      );
    }

    await tx.solicitacaoExternaSvoHistorico.create({
      data: {
        solicitacaoExternaId: atual.id,
        autorId: usuario.id,
        perfilAutor: perfilResponsavel,
        acao: acaoHistorico,
        statusAnterior: statusAtual,
        statusNovo: parsed.statusNovo,
        mensagemPublica,
        observacaoInterna,
        criadoEm: agora,
      },
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: acaoHistorico,
        tabelaAfetada: TABELA_AUDITORIA_SOLICITACAO_EXTERNA_SVO,
        registroId: atual.id,
        dadosNovos: sanitizarLgpd({
          protocolo: atual.protocolo,
          statusAnterior: statusAtual,
          statusNovo: parsed.statusNovo,
          chamadoSvoId: parsed.chamadoSvoId ?? atual.chamadoSvoId,
          motivoRecusa: parsed.motivoRecusa ?? null,
        }) as Prisma.InputJsonValue,
      },
    });

    const registroAtualizado = await tx.solicitacaoExternaSvo.findUniqueOrThrow({
      where: { id: atual.id },
      include: incluirRelacoesSolicitacaoExterna,
    });

    return usuario.perfis.includes("EXTERNO")
      ? serializarSolicitacaoExternaPublica(registroAtualizado)
      : serializarSolicitacaoExternaInterna(registroAtualizado);
  });
}
