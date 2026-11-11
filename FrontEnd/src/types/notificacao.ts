export type TipoNotificacao =
  | "SOLICITACAO_URGENTE"
  | "VIAGEM_APROVADA"
  | "VIAGEM_RECUSADA"
  | "CNH_VENCENDO"
  | "DOCUMENTO_VEICULO_VENCENDO"
  | "SVO_DESINFECCAO_CONCLUIDA"
  | "REVISAO_PREVENTIVA_PROXIMA"
  | "REVISAO_PREVENTIVA_VENCIDA";

export interface NotificacaoItem {
  id: string;
  tipo: TipoNotificacao | (string & {});
  titulo: string;
  mensagem: string;
  referenciaTipo: string | null;
  referenciaId: string | null;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string;
}

export interface ListaNotificacoesResponse {
  data: NotificacaoItem[];
  meta: {
    naoLidas: number;
    retornadas: number;
  };
}

export interface MarcarTodasLidasResponse {
  atualizadas: number;
  naoLidas: number;
}
