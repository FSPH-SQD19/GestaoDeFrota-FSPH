// Tipos do relatório operacional e agregações da frota.
// Contratos dos endpoints GET /api/v1/relatorios e /api/v1/relatorios/{consumo|manutencoes|viagens}.

export type UnidadeOperacao = "viagens" | "coletas";

export interface RelatorioVeiculo {
  id: string;
  codigo: string;
  descricao: string;
  operacoes: number;
  unidade: UnidadeOperacao;
  kmRodados: number;
  kmMedio: number | null;
  consumoLitros: number;
  consumoMedio: number | null;
  /** Barra destacada no gráfico (frota SVO). */
  destaque?: boolean;
}

export interface RelatorioMotorista {
  id: string;
  nome: string;
  operacoes: number;
  unidade: UnidadeOperacao;
}

export interface RelatorioPeriodo {
  id: string;
  rotulo: string;
  kmRodados: number;
  consumoEstimadoLitros: number;
  viagensConcluidas: number;
  viagensEmAberto: number;
  desviosDeRota: number | null;
  veiculos: RelatorioVeiculo[];
  motoristas: RelatorioMotorista[];
}

export type TipoRelatorioAgregado = "consumo" | "manutencoes" | "viagens";
export type FormatoExportacaoRelatorio = "csv" | "pdf";

export interface ItemRelatorioConsumo {
  placa: string;
  modelo: string;
  kmRodados: number;
  litrosAbastecidos: number;
  consumoMedioKmL: number | null;
}

export interface ItemRelatorioManutencao {
  tipo: string;
  status: string;
  quantidade: number;
  custoTotal: number;
}

export interface ItemRelatorioViagemSetor {
  setor: string | null;
  status: string;
  viagens: number;
}

export interface RespostaRelatorioAgregado<T> {
  inicio: string;
  fim: string;
  setor: string | null;
  dados: T[];
}
