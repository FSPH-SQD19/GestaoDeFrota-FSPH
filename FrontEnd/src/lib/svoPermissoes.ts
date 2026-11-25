export function ehSolicitanteExternoSvo(roles: readonly string[] = []): boolean {
  const temPerfilExterno = roles.includes("SOLICITANTE_EXTERNO") || roles.includes("EXTERNO");
  const temPerfilOperacao =
    roles.includes("ADMIN") || roles.includes("SVO") || roles.includes("GESTOR");
  return temPerfilExterno && !temPerfilOperacao;
}

export function deduplicarNotificacoes<T extends { id: string; chaveUnica?: string | null }>(
  itens: readonly T[],
): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];

  for (const item of itens) {
    const chave = item.chaveUnica ? `chave:${item.chaveUnica}` : `id:${item.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(item);
  }

  return resultado;
}
