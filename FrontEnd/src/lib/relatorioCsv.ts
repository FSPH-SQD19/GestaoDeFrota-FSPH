import type { RelatorioPeriodo } from "../types/relatorio";

export function gerarCsv(periodo: RelatorioPeriodo): string {
  const cabecalho = [
    "Veículo",
    "Descrição",
    "Operações",
    "Unidade",
    "Km rodados",
    "Km médio / Viagem",
    "Consumo total (L)",
    "Consumo médio / Viagem",
  ];
  const linhas = periodo.veiculos.map((veiculo) => [
    veiculo.codigo,
    veiculo.descricao,
    String(veiculo.operacoes),
    veiculo.unidade,
    String(veiculo.kmRodados),
    veiculo.kmMedio === null ? "" : String(veiculo.kmMedio),
    String(veiculo.consumoLitros),
    veiculo.consumoMedio === null ? "" : String(veiculo.consumoMedio),
  ]);
  return [cabecalho, ...linhas]
    .map((colunas) =>
      colunas
        .map((valor) => {
          // Evita fórmulas de planilha e preserva separadores, aspas e quebras de linha.
          const seguro = /^[=+@\-\t\r]/.test(valor) ? `'${valor}` : valor;
          return `"${seguro.replaceAll('"', '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n");
}
