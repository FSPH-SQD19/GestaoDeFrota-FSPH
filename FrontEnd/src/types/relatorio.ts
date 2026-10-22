// Tipos do relatório operacional da frota.
// Dados sintéticos do protótipo; o cálculo real entra quando existir endpoint.

export type UnidadeOperacao = "viagens" | "coletas";

export interface RelatorioVeiculo {
  id: string;
  codigo: string;
  descricao: string;
  operacoes: number;
  unidade: UnidadeOperacao;
  kmRodados: number;
  kmMedio: number;
  consumoLitros: number;
  consumoMedio: number;
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
  desviosDeRota: number;
  veiculos: RelatorioVeiculo[];
  motoristas: RelatorioMotorista[];
}
