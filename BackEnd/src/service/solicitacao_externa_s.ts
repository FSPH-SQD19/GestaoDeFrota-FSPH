import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import type { UsuarioAutenticado } from "../middleware/http_m";
import { notificarSolicitanteExterno } from "./notificacao_s";
import { sanitizarLgpd } from "./auditoria_s";
import {
  gerarProtocoloSolicitacaoExternaSvo,
  transicionarSolicitacaoExternaSvo,
} from "./solicitacao_externa_svo_s";

export const ESTADOS_SOLICITACAO_EXTERNA = [
  "AGUARDANDO_TRIAGEM",
  "AGUARDANDO_COMPLEMENTACAO",
  "AGUARDANDO_GESTOR",
  "APROVADA",
  "RECUSADA",
] as const;

export type EstadoSolicitacaoExterna = (typeof ESTADOS_SOLICITACAO_EXTERNA)[number];

const ESTADO_INICIAL: EstadoSolicitacaoExterna = "AGUARDANDO_TRIAGEM";
const ESTADO_COMPLEMENTACAO: EstadoSolicitacaoExterna = "AGUARDANDO_COMPLEMENTACAO";

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
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email({ error: "Digite um e-mail válido." })
        .max(150, "O e-mail deve ter no máximo 150 caracteres."),
    )
    .optional(),
  nomeFalecido: z
    .string({ error: "Informe a identificação do falecido." })
    .trim()
    .min(2, "O nome deve ter ao menos 2 caracteres.")
    .max(150, "O nome deve ter no máximo 150 caracteres.")
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
    .max(1000, "A descrição deve ter no máximo 1000 caracteres."),
});

export const complementarSolicitacaoExternaSchema = z.object({
  complemento: z
    .string({ error: "Informe as informações solicitadas." })
    .trim()
    .min(5, "O complemento deve ter ao menos 5 caracteres.")
    .max(1000, "O complemento deve ter no máximo 1000 caracteres."),
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

const MENSAGENS_PUBLICAS: Record<EstadoSolicitacaoExterna, { situacao: string; mensagem: string }> =
  {
    AGUARDANDO_TRIAGEM: {
      situacao: "Recebida",
      mensagem: "Recebemos sua solicitação e ela será analisada pela equipe de atendimento.",
    },
    AGUARDANDO_COMPLEMENTACAO: {
      situacao: "Precisamos de mais informações",
      mensagem:
        "Revise o contato, o endereço e a descrição. Envie as informações que faltam sem identificar pacientes ou terceiros.",
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

const incluirHistorico = {
  historico: {
    orderBy: { criadoEm: "asc" as const },
    select: {
      statusNovo: true,
      criadoEm: true,
    },
  },
} satisfies Prisma.SolicitacaoExternaSvoInclude;

type SolicitacaoComHistorico = Prisma.SolicitacaoExternaSvoGetPayload<{
  include: typeof incluirHistorico;
}>;

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
  historico: { situacao: string; ocorridoEm: Date }[];
};

function serializarResumo(registro: {
  id: string;
  protocolo: string;
  status: string;
  criadoEm: Date;
  atualizadoEm: Date;
}): SolicitacaoExternaResumo {
  const status = ESTADOS_SOLICITACAO_EXTERNA.includes(registro.status as EstadoSolicitacaoExterna)
    ? (registro.status as EstadoSolicitacaoExterna)
    : null;
  const padrao = status ? MENSAGENS_PUBLICAS[status] : MENSAGEM_GENERICA;

  return {
    id: registro.id,
    protocolo: registro.protocolo,
    situacao: padrao.situacao,
    mensagem: padrao.mensagem,
    permiteComplementar: status === ESTADO_COMPLEMENTACAO,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export function serializarSolicitacaoExterna(
  registro: SolicitacaoComHistorico,
): SolicitacaoExternaDetalhe {
  return {
    ...serializarResumo(registro),
    historico: registro.historico.map((item) => ({
      situacao: (
        MENSAGENS_PUBLICAS[item.statusNovo as EstadoSolicitacaoExterna] ?? MENSAGEM_GENERICA
      ).situacao,
      ocorridoEm: item.criadoEm,
    })),
  };
}

function buscarPorChave(chaveIdempotencia: string) {
  return prisma.solicitacaoExternaSvo.findUnique({
    where: { chaveIdempotencia },
    include: incluirHistorico,
  });
}

function responderComExistente(
  existente: SolicitacaoComHistorico,
  usuarioId: string,
): { solicitacao: SolicitacaoExternaDetalhe; criada: false } {
  if (existente.solicitanteId !== usuarioId) {
    throw new HttpError(409, "Chave de idempotência já utilizada em outra solicitação.");
  }
  return { solicitacao: serializarSolicitacaoExterna(existente), criada: false };
}

export async function criarSolicitacaoExterna(
  input: CriarSolicitacaoExternaInput,
  usuarioId: string,
  chaveIdempotencia: string,
  agora: Date = new Date(),
): Promise<{ solicitacao: SolicitacaoExternaDetalhe; criada: boolean }> {
  const existente = await buscarPorChave(chaveIdempotencia);
  if (existente) return responderComExistente(existente, usuarioId);

  try {
    const criada = await prisma.$transaction(async (tx) => {
      const protocolo = await gerarProtocoloSolicitacaoExternaSvo(tx, agora);
      const registro = await tx.solicitacaoExternaSvo.create({
        data: {
          protocolo,
          solicitanteId: usuarioId,
          nomeContato: input.contatoNome,
          telefoneContato: input.contatoTelefone,
          contatoEmail: input.contatoEmail ?? null,
          nomeFalecido: input.nomeFalecido ?? null,
          enderecoOcorrencia: input.enderecoOcorrencia,
          relatoOcorrencia: input.relatoOcorrencia,
          status: ESTADO_INICIAL,
          chaveIdempotencia,
          historico: {
            create: {
              autorId: usuarioId,
              perfilAutor: "EXTERNO",
              acao: "SOLICITACAO_CRIADA",
              statusAnterior: null,
              statusNovo: ESTADO_INICIAL,
              mensagemPublica: MENSAGENS_PUBLICAS[ESTADO_INICIAL].mensagem,
            },
          },
        },
        include: incluirHistorico,
      });

      await notificarSolicitanteExterno(tx, registro, MENSAGENS_PUBLICAS[ESTADO_INICIAL].mensagem);
      await tx.auditoriaSistema.create({
        data: {
          usuarioId,
          acao: "CRIAR",
          tabelaAfetada: "solicitacoes_externas_svo",
          registroId: registro.id,
          dadosNovos: sanitizarLgpd({ protocolo, status: ESTADO_INICIAL }) as Prisma.InputJsonValue,
        },
      });
      return registro;
    });

    return { solicitacao: serializarSolicitacaoExterna(criada), criada: true };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const jaCriada = await buscarPorChave(chaveIdempotencia);
      if (jaCriada) return responderComExistente(jaCriada, usuarioId);
    }
    throw erro;
  }
}

export async function listarSolicitacoesExternas(
  filtros: ListarSolicitacoesExternasFiltros,
  usuarioId: string,
) {
  const { page, pageSize, estado } = filtros;
  const where: Prisma.SolicitacaoExternaSvoWhereInput = {
    solicitanteId: usuarioId,
    ...(estado ? { status: estado } : {}),
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
    data: registros.map((registro) => serializarResumo(registro)),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

function erroNaoEncontrada() {
  return new HttpError(404, "Solicitação não encontrada.");
}

export async function detalharSolicitacaoExterna(id: string, usuarioId: string) {
  const registro = await prisma.solicitacaoExternaSvo.findFirst({
    where: { id, solicitanteId: usuarioId },
    include: incluirHistorico,
  });
  if (!registro) throw erroNaoEncontrada();
  return serializarSolicitacaoExterna(registro);
}

export async function complementarSolicitacaoExterna(
  id: string,
  input: ComplementarSolicitacaoExternaInput,
  usuario: UsuarioAutenticado,
) {
  const atual = await prisma.solicitacaoExternaSvo.findFirst({
    where: { id, solicitanteId: usuario.id },
    select: { id: true, status: true, versao: true },
  });
  if (!atual) throw erroNaoEncontrada();
  if (atual.status !== ESTADO_COMPLEMENTACAO) {
    throw new HttpError(422, "Esta solicitação não está aguardando complementação.", [
      {
        campo: "id",
        mensagem: "Só é possível complementar quando o atendimento solicitar mais informações.",
      },
    ]);
  }

  await transicionarSolicitacaoExternaSvo(
    {
      solicitacaoId: id,
      statusNovo: ESTADO_INICIAL,
      versaoEsperada: atual.versao,
      complementacaoEnviada: input.complemento,
    },
    usuario,
  );
  return detalharSolicitacaoExterna(id, usuario.id);
}
