type Intervalo = { id: string; inicio: string; fim: string };

export type Ocupacao = Intervalo & {
  veiculoId: string | null;
  motoristaId: string | null;
} & (
    | { tipo: "VIAGEM"; protocolo: string; status: "APROVADA" | "EM_TRANSITO" }
    | { tipo: "MANUTENCAO"; motivo: string | null }
  );

export function intervalosLivres(inicio: string, fim: string, ocupacoes: Ocupacao[]) {
  const livres: (Intervalo & { tipo: "LIVRE" })[] = [];
  const limite = Date.parse(fim);
  let cursor = Date.parse(inicio);
  const adicionar = (de: number, ate: number) =>
    livres.push({
      id: `livre-${de}`,
      tipo: "LIVRE",
      inicio: new Date(de).toISOString(),
      fim: new Date(ate).toISOString(),
    });

  for (const ocupacao of [...ocupacoes].sort(
    (a, b) => Date.parse(a.inicio) - Date.parse(b.inicio),
  )) {
    const comeco = Math.min(Date.parse(ocupacao.inicio), limite);
    if (cursor < comeco) adicionar(cursor, comeco);
    cursor = Math.max(cursor, Math.min(Date.parse(ocupacao.fim), limite));
  }
  if (cursor < limite) adicionar(cursor, limite);
  return livres;
}
