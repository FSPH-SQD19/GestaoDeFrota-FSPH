export interface UsuarioAuditoria {
  id: string;
  nome: string;
  email?: string;
  setor?: string;
}

export interface ItemAuditoria {
  id: string;
  usuarioId: string | null;
  acao: string;
  tabelaAfetada: string;
  registroId: string | null;
  dadosNovos: Record<string, unknown> | null;
  criadoEm: string;
  usuario?: UsuarioAuditoria | null;
}

export interface FiltrosAuditoria {
  page?: number;
  pageSize?: number;
  tabelaAfetada?: string;
  acao?: string;
  usuarioId?: string;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface ListaAuditoriaResposta {
  data: ItemAuditoria[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
