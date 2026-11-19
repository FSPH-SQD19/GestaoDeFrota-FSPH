import { api } from "./api";
import { respostaDeErro } from "../lib/api";
import { z } from "zod";

export type StatusSolicitacaoExternaSvo =
  | "AGUARDANDO_TRIAGEM"
  | "DEVOLVIDA_PARA_COMPLEMENTACAO"
  | "AGUARDANDO_GESTOR"
  | "APROVADA"
  | "RECUSADA";

export interface HistoricoSolicitacaoExternaSvo {
  statusAnterior?: StatusSolicitacaoExternaSvo | null;
  statusNovo: StatusSolicitacaoExternaSvo;
  justificativa?: string | null;
  autorNome?: string | null;
  criadoEm?: string | null;
}

export interface SolicitacaoExternaSvo {
  id: string;
  protocolo: string;
  status: StatusSolicitacaoExternaSvo;
  nomeSolicitante?: string | null;
  contato?: string | null;
  enderecoOcorrencia?: string | null;
  localOcorrencia?: string | null;
  descricao?: string | null;
  relatoTriagem?: string | null;
  justificativa?: string | null;
  chamadoSvoId?: string | null;
  chamadoSvoProtocolo?: string | null;
  criadoEm: string;
  triadaEm?: string | null;
  decididaEm?: string | null;
  historico?: HistoricoSolicitacaoExternaSvo[];
}

export interface PaginaSolicitacoesExternasSvo {
  data: SolicitacaoExternaSvo[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DecisaoGestorInput {
  justificativa?: string;
  chaveIdempotencia?: string;
}

const BASE = "/api/v1/solicitacoes-externas-svo";

const statusSchema = z.enum([
  "AGUARDANDO_TRIAGEM",
  "DEVOLVIDA_PARA_COMPLEMENTACAO",
  "AGUARDANDO_GESTOR",
  "APROVADA",
  "RECUSADA",
]);

const solicitacaoSchema = z
  .object({
    id: z.string(),
    protocolo: z.string(),
    status: statusSchema,
    nomeSolicitante: z.string().nullable().optional(),
    contato: z.string().nullable().optional(),
    enderecoOcorrencia: z.string().nullable().optional(),
    localOcorrencia: z.string().nullable().optional(),
    descricao: z.string().nullable().optional(),
    relatoTriagem: z.string().nullable().optional(),
    justificativa: z.string().nullable().optional(),
    chamadoSvoId: z.string().nullable().optional(),
    chamadoSvoProtocolo: z.string().nullable().optional(),
    criadoEm: z.string().nullable().optional(),
    triadaEm: z.string().nullable().optional(),
    decididaEm: z.string().nullable().optional(),
  })
  .passthrough();

const paginaSchema = z
  .object({
    data: z.array(solicitacaoSchema),
    meta: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  })
  .passthrough();

export async function listarSolicitacoesExternasSvoGestor(
  page = 1,
  pageSize = 20,
): Promise<PaginaSolicitacoesExternasSvo> {
  try {
    const response = await api.get<unknown>(
      `${BASE}/gestor?page=${page}&pageSize=${pageSize}`,
    );
    const parsed = paginaSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(
        "Não foi possível interpretar a fila de solicitações externas. Atualize a página e tente novamente.",
      );
    }
    return parsed.data as PaginaSolicitacoesExternasSvo;
  } catch (error) {
    throw new Error(
      respostaDeErro(error, "Não foi possível carregar as solicitações externas para decisão."),
    );
  }
}

async function decidirSolicitacaoExternaSvo(
  id: string,
  decisao: "aprovar" | "recusar",
  dados: DecisaoGestorInput,
) {
  try {
    const { chaveIdempotencia, ...corpo } = dados;
    const response = await api.patch<unknown>(
      `${BASE}/${encodeURIComponent(id)}/${decisao}`,
      corpo,
      {
        headers: chaveIdempotencia ? { "Idempotency-Key": chaveIdempotencia } : undefined,
      },
    );
    if (response.data && typeof response.data === "object") return response.data as {
      dados?: SolicitacaoExternaSvo;
      mensagem?: string;
    };
    throw new Error("O back-end confirmou uma resposta inválida da decisão.");
  } catch (error) {
    throw new Error(respostaDeErro(error, "Não foi possível registrar a decisão."));
  }
}

export function aprovarSolicitacaoExternaSvo(id: string, chaveIdempotencia: string) {
  return decidirSolicitacaoExternaSvo(id, "aprovar", { chaveIdempotencia });
}

export function recusarSolicitacaoExternaSvo(
  id: string,
  justificativa: string,
  chaveIdempotencia: string,
) {
  return decidirSolicitacaoExternaSvo(id, "recusar", {
    justificativa,
    chaveIdempotencia,
  });
}
