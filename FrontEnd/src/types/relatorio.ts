// Tipos do relatório operacional da frota.
// Contrato do endpoint GET /api/v1/relatorios.

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
