// Tipos da Solicitação de Viagem (frota administrativa).
// Alinhados ao contrato de `/api/v1/solicitacoes` no back-end.

export type StatusSolicitacao = "PENDENTE" | "APROVADA" | "EM_TRANSITO" | "CONCLUIDA" | "RECUSADA";

export type UrgenciaSolicitacao = "NORMAL" | "URGENTE";

export type TipoTransporte = "PASSAGEIROS" | "MATERIAL_BIOLOGICO" | "DOCUMENTOS_INSUMOS" | "MISTO";

export interface SolicitacaoViagem {
  id: string;
  protocolo: string;
  solicitanteId?: string;
  solicitanteNome: string;
  setorOrigem: string;
  origem: string;
  destino: string;
  /** ISO 8601 */
  dataHoraPretendida: string;
  /** ISO 8601 */
  dataHoraRetornoPrevista?: string;
  quantidadePassageiros: number;
  tipoTransporte: TipoTransporte;
  urgencia: UrgenciaSolicitacao;
  justificativa: string;
  observacoes?: string;
  status: StatusSolicitacao;
  /** ISO 8601 */
  criadoEm: string;
  motivoRecusa?: string;
  veiculoAlocadoId?: string | null;
  motoristaAlocadoId?: string | null;
  veiculoAlocado?: { placa: string; modelo: string };
  motoristaAlocado?: { nome: string };
}

export type NovaSolicitacaoViagem = Pick<
  SolicitacaoViagem,
  | "setorOrigem"
  | "origem"
  | "destino"
  | "dataHoraPretendida"
  | "dataHoraRetornoPrevista"
  | "quantidadePassageiros"
  | "tipoTransporte"
  | "urgencia"
  | "justificativa"
  | "observacoes"
>;

export type ContagemPorStatus = Record<StatusSolicitacao, number>;

export interface MetaPaginacaoSolicitacoes {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  porStatus: ContagemPorStatus;
}

export interface ListaSolicitacoesResposta {
  data: SolicitacaoViagem[];
  meta: MetaPaginacaoSolicitacoes;
}

export interface ListarSolicitacoesParams {
  page?: number;
  pageSize?: number;
  status?: StatusSolicitacao[];
  urgencia?: UrgenciaSolicitacao;
  tipoTransporte?: TipoTransporte;
  busca?: string;
}

export interface VeiculoDisponivelOption {
  id: string;
  placa: string;
  modelo: string;
  capacidadeMaxima: number;
  combustivel?: string | null;
}

export interface MotoristaDisponivelOption {
  id: string;
  nome: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
}

export interface AprovarSolicitacaoInput {
  veiculoAlocadoId: string;
  motoristaAlocadoId: string;
}

export interface RecusarSolicitacaoInput {
  motivoRecusa: string;
}

export const STATUS_SOLICITACAO_LABEL: Record<StatusSolicitacao, string> = {
  PENDENTE: "Aguardando aprovação",
  APROVADA: "Aprovada",
  EM_TRANSITO: "Em trânsito",
  CONCLUIDA: "Concluída",
  RECUSADA: "Recusada",
};

export const STATUS_SOLICITACAO_VARIANT: Record<
  StatusSolicitacao,
  "success" | "info" | "warning" | "danger" | "neutral"
> = {
  PENDENTE: "warning",
  APROVADA: "success",
  EM_TRANSITO: "info",
  CONCLUIDA: "success",
  RECUSADA: "danger",
};

export const TIPO_TRANSPORTE_LABEL: Record<TipoTransporte, string> = {
  PASSAGEIROS: "Apenas passageiros",
  MATERIAL_BIOLOGICO: "Amostras biológicas / exames",
  DOCUMENTOS_INSUMOS: "Documentos / insumos",
  MISTO: "Passageiros e carga",
};

export const SETORES_FSPH = [
  "LACEN",
  "Hemose",
  "Diretoria Administrativa",
  "Diretoria de Atenção à Saúde",
  "Vigilância em Saúde",
  "Recursos Humanos",
] as const;
