export type GravidadeMulta = "LEVE" | "MEDIA" | "GRAVE" | "GRAVISSIMA";
export type StatusMulta = "PENDENTE" | "PAGA" | "EM_RECURSO";

export interface Multa {
  id: string;
  autoInfracao: string;
  veiculoId: string;
  motoristaId?: string | null;
  solicitacaoId?: string | null;
  dataHora: string;
  gravidade: GravidadeMulta;
  pontos: number;
  pontosAtivos?: number;
  expirada?: boolean;
  valor: number;
  descricao?: string | null;
  local?: string | null;
  orgaoEmissor?: string | null;
  status: StatusMulta;
  dataVencimento?: string | null;
  dataPagamento?: string | null;
  observacoes?: string | null;
  criadoEm?: string;
  veiculo?: {
    id: string;
    placa: string;
    modelo: string;
    tipoFrota?: string;
  } | null;
  motorista?: {
    id: string;
    numeroCnh: string;
    cpf: string;
    usuario?: {
      id: string;
      nome: string;
      email: string;
    } | null;
  } | null;
  solicitacao?: {
    id: string;
    protocolo: string;
    destino?: string | null;
  } | null;
}

export interface ResumoMultasMotorista {
  totalMultas: number;
  totalPontos: number;
  valorTotal: number;
  multas: Multa[];
}

export interface CriarMultaPayload {
  autoInfracao: string;
  veiculoId: string;
  motoristaId?: string | null;
  solicitacaoId?: string | null;
  dataHora: string;
  gravidade: GravidadeMulta;
  pontos?: number;
  valor: number;
  descricao?: string | null;
  local?: string | null;
  orgaoEmissor?: string | null;
  status?: StatusMulta;
  dataVencimento?: string | null;
  dataPagamento?: string | null;
  observacoes?: string | null;
}

export interface AtualizarMultaPayload {
  status?: StatusMulta;
  dataPagamento?: string | null;
  motoristaId?: string | null;
  observacoes?: string | null;
}
