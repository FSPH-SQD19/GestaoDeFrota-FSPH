import type { Coordenadas } from "./types";
// Project segments to a local metric plane; adequate for the 50 m deviation threshold.
export function distanciaDaRota(p: Coordenadas, linha: Coordenadas[]): number {
  if (linha.length < 2) return Infinity;
  const scale = Math.cos((p[1] * Math.PI) / 180),
    x = (lng: number) => (lng - p[0]) * 111320 * scale,
    y = (lat: number) => (lat - p[1]) * 111320;
  let min = Infinity;
  for (let i = 1; i < linha.length; i++) {
    const ax = x(linha[i - 1][0]),
      ay = y(linha[i - 1][1]),
      bx = x(linha[i][0]),
      by = y(linha[i][1]);
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}
export function estadoPosicao(capturadaEm: string, agora = Date.now()) {
  const idade = agora - Date.parse(capturadaEm);
  return idade >= 120000
    ? "Sem atualização"
    : idade >= 30000
      ? "Posição desatualizada"
      : "Atualizada";
}
