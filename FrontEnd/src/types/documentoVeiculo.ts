export interface DocumentoVeiculo {
  id: string;
  veiculoId: string;
  tipoDocumento: string | null;
  dataVencimento: string;
  situacao: "VIGENTE" | "PROXIMO_VENCIMENTO" | "VENCIDO";
  diasParaVencer: number;
  atual: boolean;
}

export interface DocumentosVeiculoResponse {
  data: DocumentoVeiculo[];
  resumo: {
    situacaoGeral: DocumentoVeiculo["situacao"] | null;
    bloqueiaAlocacao: boolean;
    tiposSemRegistro: string[];
  };
}

export interface AlertaDocumentoVeiculo extends DocumentoVeiculo {
  placa: string;
}
