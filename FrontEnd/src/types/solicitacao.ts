// Tipos da Solicitação de Viagem (frota administrativa).
// Alinhados ao model `SolicitacaoViagem` do Prisma; campos extras serão
// incorporados ao schema quando o endpoint do back-end for criado.

export type StatusSolicitacao = "PENDENTE" | "APROVADA" | "EM_TRANSITO" | "CONCLUIDA" | "RECUSADA";

export type UrgenciaSolicitacao = "NORMAL" | "URGENTE";

export type TipoTransporte = "PASSAGEIROS" | "MATERIAL_BIOLOGICO" | "DOCUMENTOS_INSUMOS" | "MISTO";

export interface SolicitacaoViagem {
  id: string;
  protocolo: string;
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
