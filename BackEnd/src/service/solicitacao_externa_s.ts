import { Prisma, type SolicitacaoExternaSvo } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";

// Estados e tipos de histórico

export const ESTADOS_SOLICITACAO_EXTERNA = [
  "AGUARDANDO_TRIAGEM",
  "AGUARDANDO_COMPLEMENTACAO",
  "AGUARDANDO_GESTOR",
  "APROVADA",
  "RECUSADA",
] as const;

export type EstadoSolicitacaoExterna = (typeof ESTADOS_SOLICITACAO_EXTERNA)[number];

export const ESTADO_INICIAL: EstadoSolicitacaoExterna = "AGUARDANDO_TRIAGEM";
export const ESTADO_COMPLEMENTACAO: EstadoSolicitacaoExterna = "AGUARDANDO_COMPLEMENTACAO";

export const TIPO_HISTORICO_CRIACAO = "CRIACAO";
export const TIPO_HISTORICO_COMPLEMENTO = "COMPLEMENTO";

// Validação

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

const TELEFONE_REGEX = /^[1-9]{2}9?\d{8}$/;

export const criarSolicitacaoExternaSchema = z.object({
  contatoNome: z
    .string({ error: "Informe o nome do contato." })
    .trim()
    .min(2, "O nome deve ter ao menos 2 caracteres.")
    .max(150, "O nome deve ter no máximo 150 caracteres."),
  contatoTelefone: z
    .string({ error: "Informe um telefone para contato." })
    .transform(normalizarTelefone)
    .pipe(z.string().regex(TELEFONE_REGEX, "Telefone inválido. Use o formato (79) 99999-0000.")),
  contatoEmail: z
    .email({ error: "Digite um e-mail válido." })
    .max(150, "O e-mail deve ter no máximo 150 caracteres.")
    .optional(),
  enderecoOcorrencia: z
    .string({ error: "Informe o endereço da ocorrência." })
    .trim()
    .min(5, "O endereço deve ter ao menos 5 caracteres.")
    .max(300, "O endereço deve ter no máximo 300 caracteres."),
  relatoOcorrencia: z
    .string({ error: "Descreva a ocorrência." })
    .trim()
    .min(10, "A descrição deve ter ao menos 10 caracteres.")
    .max(2000, "A descrição deve ter no máximo 2000 caracteres."),
});

export const complementarSolicitacaoExternaSchema = z.object({
  complemento: z
    .string({ error: "Informe as informações solicitadas." })
    .trim()
    .min(5, "O complemento deve ter ao menos 5 caracteres.")
    .max(2000, "O complemento deve ter no máximo 2000 caracteres."),
});

export const listarSolicitacoesExternasSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  estado: z.enum(ESTADOS_SOLICITACAO_EXTERNA, { error: "Estado inválido." }).optional(),
});

export const solicitacaoExternaIdSchema = z.object({
  id: z.uuid({ error: "id deve ser um UUID válido." }),
});

export const chaveIdempotenciaSchema = z.uuid({
  error: "O cabeçalho Idempotency-Key deve ser um UUID válido.",
});

export type CriarSolicitacaoExternaInput = z.infer<typeof criarSolicitacaoExternaSchema>;
export type ComplementarSolicitacaoExternaInput = z.infer<
  typeof complementarSolicitacaoExternaSchema
>;
export type ListarSolicitacoesExternasFiltros = z.infer<typeof listarSolicitacoesExternasSchema>;

// Resposta pública (lista permitida: só sai o que está escrito aqui)

const MENSAGENS_PUBLICAS: Record<EstadoSolicitacaoExterna, { situacao: string; mensagem: string }> =
  {
    AGUARDANDO_TRIAGEM: {
      situacao: "Recebida",
      mensagem: "Recebemos sua solicitação e ela será analisada pela equipe de atendimento.",
    },
    AGUARDANDO_COMPLEMENTACAO: {
      situacao: "Precisamos de mais informações",
      mensagem: "Envie as informações solicitadas para que possamos continuar a análise.",
    },
    AGUARDANDO_GESTOR: {
      situacao: "Em análise",
      mensagem: "Sua solicitação foi analisada e está em avaliação final.",
    },
    APROVADA: {
      situacao: "Aprovada",
      mensagem: "Sua solicitação foi aprovada e será encaminhada para atendimento.",
    },
    RECUSADA: {
      situacao: "Não atendida",
      mensagem:
        "Não foi possível atender sua solicitação. Em caso de dúvida, entre em contato com o serviço.",
    },
  };

const MENSAGEM_GENERICA = {
  situacao: "Em andamento",
  mensagem: "Sua solicitação está em andamento.",
};

// Só nestes estados o texto escrito pelo atendimento (campo público) substitui a mensagem padrão.
const ESTADOS_COM_TEXTO_DO_ATENDIMENTO: string[] = ["AGUARDANDO_COMPLEMENTACAO", "RECUSADA"];

type ComplementoRegistro = { conteudo: string | null; criadoEm: Date };
type RegistroComComplementos = SolicitacaoExternaSvo & { historico: ComplementoRegistro[] };

export type SolicitacaoExternaResumo = {
  id: string;
  protocolo: string;
  situacao: string;
  mensagem: string;
  permiteComplementar: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type SolicitacaoExternaDetalhe = SolicitacaoExternaResumo & {
  dadosEnviados: {
    contatoNome: string;
    contatoTelefone: string;
    contatoEmail: string | null;
    enderecoOcorrencia: string;
    relatoOcorrencia: string;
  };
  complementos: { conteudo: string | null; enviadoEm: Date }[];
};

export function serializarResumoSolicitacaoExterna(
  registro: SolicitacaoExternaSvo,
): SolicitacaoExternaResumo {
  const padrao =
    MENSAGENS_PUBLICAS[registro.estado as EstadoSolicitacaoExterna] ?? MENSAGEM_GENERICA;
  const usaTextoDoAtendimento =
    ESTADOS_COM_TEXTO_DO_ATENDIMENTO.includes(registro.estado) &&
    !!registro.mensagemParaSolicitante;

  return {
    id: registro.id,
    protocolo: registro.protocolo,
    situacao: padrao.situacao,
    mensagem: usaTextoDoAtendimento
      ? (registro.mensagemParaSolicitante as string)
      : padrao.mensagem,
    permiteComplementar: registro.estado === ESTADO_COMPLEMENTACAO,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export function serializarSolicitacaoExterna(
  registro: RegistroComComplementos,
): SolicitacaoExternaDetalhe {
  return {
    ...serializarResumoSolicitacaoExterna(registro),
    dadosEnviados: {
      contatoNome: registro.contatoNome,
      contatoTelefone: registro.contatoTelefone,
      contatoEmail: registro.contatoEmail,
      enderecoOcorrencia: registro.enderecoOcorrencia,
      relatoOcorrencia: registro.relatoOcorrencia,
    },
    complementos: registro.historico.map((item) => ({
      conteudo: item.conteudo,
      enviadoEm: item.criadoEm,
    })),
  };
}

// Serviço

const INCLUIR_COMPLEMENTOS = {
  historico: {
    where: { tipo: TIPO_HISTORICO_COMPLEMENTO },
    orderBy: { criadoEm: "asc" },
    select: { conteudo: true, criadoEm: true },
  },
} satisfies Prisma.SolicitacaoExternaSvoInclude;

function erroNaoEncontrada() {
  return new HttpError(404, "Solicitação não encontrada.");
}

async function gerarProtocoloExterno(tx: Prisma.TransactionClient, agora: Date = new Date()) {
  const linhas = await tx.$queryRaw<
    { n: bigint }[]
  >`SELECT nextval('solicitacoes_externas_svo_protocolo_seq') AS n`;
  const numero = String(linhas[0]?.n ?? 0).padStart(6, "0");
  return `EXT-${agora.getFullYear()}-${numero}`;
}

function buscarPorChave(solicitanteId: string, chaveIdempotencia: string) {
  return prisma.solicitacaoExternaSvo.findUnique({
    where: { solicitanteId_chaveIdempotencia: { solicitanteId, chaveIdempotencia } },
    include: INCLUIR_COMPLEMENTOS,
  });
}

export async function criarSolicitacaoExterna(
  input: CriarSolicitacaoExternaInput,
  usuarioId: string,
  chaveIdempotencia: string,
): Promise<{ solicitacao: SolicitacaoExternaDetalhe; criada: boolean }> {
  // Reenvio com a mesma chave devolve a solicitação já criada, sem duplicar.
  const existente = await buscarPorChave(usuarioId, chaveIdempotencia);
  if (existente) {
    return { solicitacao: serializarSolicitacaoExterna(existente), criada: false };
  }

  try {
    const criada = await prisma.$transaction(async (tx) => {
      const protocolo = await gerarProtocoloExterno(tx);

      const registro = await tx.solicitacaoExternaSvo.create({
        data: {
          protocolo,
          solicitanteId: usuarioId,
          chaveIdempotencia,
          estado: ESTADO_INICIAL,
          ...input,
        },
      });

      await tx.solicitacaoExternaSvoHistorico.create({
        data: {
          solicitacaoId: registro.id,
          tipo: TIPO_HISTORICO_CRIACAO,
          estadoAnterior: null,
          estadoNovo: ESTADO_INICIAL,
          autorId: usuarioId,
        },
      });

      // A auditoria guarda só o necessário: sem dados pessoais nem texto livre.
      await tx.auditoriaSistema.create({
        data: {
          usuarioId,
          acao: "CRIAR",
          tabelaAfetada: "solicitacoes_externas_svo",
          registroId: registro.id,
          dadosNovos: { protocolo, estado: ESTADO_INICIAL },
        },
      });

      return registro;
    });

    return {
      solicitacao: serializarSolicitacaoExterna({ ...criada, historico: [] }),
      criada: true,
    };
  } catch (erro) {
    // Duas requisições simultâneas com a mesma chave: a segunda cai aqui.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const jaCriada = await buscarPorChave(usuarioId, chaveIdempotencia);
      if (jaCriada) {
        return { solicitacao: serializarSolicitacaoExterna(jaCriada), criada: false };
      }
    }
    throw erro;
  }
}

export async function listarSolicitacoesExternas(
  filtros: ListarSolicitacoesExternasFiltros,
  usuarioId: string,
) {
  const { page, pageSize, estado } = filtros;

  // O escopo por dono é parte da própria consulta, nunca vem do corpo ou da URL.
  const where: Prisma.SolicitacaoExternaSvoWhereInput = {
    solicitanteId: usuarioId,
    ...(estado ? { estado } : {}),
  };

  const [registros, total] = await Promise.all([
    prisma.solicitacaoExternaSvo.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitacaoExternaSvo.count({ where }),
  ]);

  return {
    data: registros.map((registro) => serializarResumoSolicitacaoExterna(registro)),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function detalharSolicitacaoExterna(id: string, usuarioId: string) {
  // Solicitação de outra pessoa devolve 404, para não revelar que o protocolo existe.
  const registro = await prisma.solicitacaoExternaSvo.findFirst({
    where: { id, solicitanteId: usuarioId },
    include: INCLUIR_COMPLEMENTOS,
  });
  if (!registro) {
    throw erroNaoEncontrada();
  }
  return serializarSolicitacaoExterna(registro);
}

export async function complementarSolicitacaoExterna(
  id: string,
  input: ComplementarSolicitacaoExternaInput,
  usuarioId: string,
) {
  const atual = await prisma.solicitacaoExternaSvo.findFirst({
    where: { id, solicitanteId: usuarioId },
    select: { id: true, estado: true },
  });
  if (!atual) {
    throw erroNaoEncontrada();
  }
  if (atual.estado !== ESTADO_COMPLEMENTACAO) {
    throw new HttpError(422, "Esta solicitação não está aguardando complementação.", [
      {
        campo: "id",
        mensagem: "Só é possível complementar quando o atendimento solicitar mais informações.",
      },
    ]);
  }

  const atualizada = await prisma.$transaction(async (tx) => {
    // A condição de estado no próprio UPDATE impede envio duplo do complemento.
    const { count } = await tx.solicitacaoExternaSvo.updateMany({
      where: { id, solicitanteId: usuarioId, estado: ESTADO_COMPLEMENTACAO },
      data: { estado: ESTADO_INICIAL, mensagemParaSolicitante: null },
    });
    if (count === 0) {
      return null;
    }

    await tx.solicitacaoExternaSvoHistorico.create({
      data: {
        solicitacaoId: id,
        tipo: TIPO_HISTORICO_COMPLEMENTO,
        estadoAnterior: ESTADO_COMPLEMENTACAO,
        estadoNovo: ESTADO_INICIAL,
        autorId: usuarioId,
        conteudo: input.complemento,
      },
    });

    await tx.auditoriaSistema.create({
      data: {
        usuarioId,
        acao: "COMPLEMENTAR",
        tabelaAfetada: "solicitacoes_externas_svo",
        registroId: id,
        dadosNovos: { estadoAnterior: ESTADO_COMPLEMENTACAO, estadoNovo: ESTADO_INICIAL },
      },
    });

    return tx.solicitacaoExternaSvo.findUniqueOrThrow({
      where: { id },
      include: INCLUIR_COMPLEMENTOS,
    });
  });

  if (!atualizada) {
    throw new HttpError(409, "A solicitação foi atualizada por outra requisição. Recarregue.");
  }
  return serializarSolicitacaoExterna(atualizada);
}
