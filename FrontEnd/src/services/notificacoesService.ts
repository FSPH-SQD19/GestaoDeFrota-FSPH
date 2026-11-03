import { api } from "./api";
import type {
  ListaNotificacoesResponse,
  MarcarTodasLidasResponse,
  NotificacaoItem,
} from "../types/notificacao";

export const EVENTO_ATUALIZAR_NOTIFICACOES = "frota-notificacoes-atualizar";

const RESPOSTA_VAZIA: ListaNotificacoesResponse = {
  data: [],
  meta: { naoLidas: 0, retornadas: 0 },
};

export function dispararAtualizacaoNotificacoes(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_ATUALIZAR_NOTIFICACOES));
  }
}

export async function listarNotificacoesApi(params?: {
  apenasNaoLidas?: boolean;
  limit?: number;
}): Promise<ListaNotificacoesResponse> {
  const response = await api.get<unknown>("/api/v1/notificacoes", {
    params: {
      ...(params?.apenasNaoLidas ? { apenasNaoLidas: "true" } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  });

  const corpo = response?.data as Partial<ListaNotificacoesResponse> | undefined;
  if (!corpo || typeof corpo !== "object" || !Array.isArray(corpo.data)) {
    return RESPOSTA_VAZIA;
  }

  const naoLidas =
    typeof corpo.meta?.naoLidas === "number" && Number.isFinite(corpo.meta.naoLidas)
      ? corpo.meta.naoLidas
      : corpo.data.filter((item) => !item.lida).length;

  return {
    data: corpo.data,
    meta: {
      naoLidas,
      retornadas: corpo.data.length,
    },
  };
}

export async function marcarNotificacaoLidaApi(id: string): Promise<NotificacaoItem> {
  const { data } = await api.patch<NotificacaoItem>(
    `/api/v1/notificacoes/${encodeURIComponent(id)}/lida`,
  );
  return data;
}

export async function marcarTodasNotificacoesLidasApi(): Promise<MarcarTodasLidasResponse> {
  const { data } = await api.patch<MarcarTodasLidasResponse>("/api/v1/notificacoes/ler-todas");
  return data;
}
