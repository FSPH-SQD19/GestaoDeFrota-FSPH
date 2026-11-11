export interface UsuarioAuditoria {
  id: string;
  nome: string;
  matricula: string;
  perfil: string;
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
  pagina?: number;
  limite?: number;
  tabelaAfetada?: string;
  acao?: string;
  usuarioId?: string;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface ListaAuditoriaResposta {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  itens: ItemAuditoria[];
}
