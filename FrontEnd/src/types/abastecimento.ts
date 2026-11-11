export interface AbastecimentoMotorista {
  id: string;
  veiculoId: string;
  motoristaId?: string | null;
  fornecedorId?: string | null;
  /** ISO 8601 */
  dataHora: string;
  odometro: number | null;
  litros: number | null;
  valorTotal: number | null;
  postoCredenciado?: string | null;
  kmPorLitro?: number | null;
}

export interface ListaAbastecimentosResposta {
  data: AbastecimentoMotorista[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CriarAbastecimentoMotoristaInput {
  veiculoId?: string;
  odometro: number;
  litros: number;
  valorTotal: number;
  postoCredenciado?: string;
}

export interface ListarMeusAbastecimentosParams {
  page?: number;
  pageSize?: number;
  veiculoId?: string;
}
