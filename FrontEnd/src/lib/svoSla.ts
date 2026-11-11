export function formatarDuracaoSla(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos)) return "—";
  const total = Math.max(0, Math.round(minutos));
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
}

export function minutosDesde(iso: string | null | undefined, agora = Date.now()): number | null {
  if (!iso) return null;
  const inicio = new Date(iso).getTime();
  if (!Number.isFinite(inicio)) return null;
  return Math.max(0, (agora - inicio) / 60_000);
}

export function chamadoAbertoParaSla(chamado: {
  statusTriagem: string;
  ordemColeta?: { status: string } | null;
}): boolean {
  if (chamado.statusTriagem === "RECUSADO") return false;
  const status = chamado.ordemColeta?.status;
  return !status || !["ENTREGUE_SVO", "CONCLUIDA", "CANCELADA"].includes(status);
}
