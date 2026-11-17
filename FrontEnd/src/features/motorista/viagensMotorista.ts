import type { Coordenadas, Tarefas, Veiculo } from "./types";
export type ViagemMotorista = {
  id: string;
  tipo: "ADMINISTRATIVA" | "SVO";
  destino: string;
  origem: string;
  veiculo: Veiculo | null;
  coordenadas?: number[] | Coordenadas | null;
  categoria: string;
  horario?: string | null;
  passageiros?: number;
  protocolo?: string;
  coletas?: number;
};
const transporte: Record<string, string> = {
  PASSAGEIROS: "Passageiros",
  MATERIAL_BIOLOGICO: "Material biológico",
  DOCUMENTOS_INSUMOS: "Documentos e insumos",
  MISTO: "Transporte misto",
};
export function viagensDoMotorista(tarefas: Tarefas | undefined): ViagemMotorista[] {
  if (!tarefas) return [];
  const administrativas: ViagemMotorista[] = tarefas.administrativas.map((t) => ({
    id: t.id,
    tipo: "ADMINISTRATIVA",
    destino: t.destino || "Destino a confirmar",
    origem: t.origem || "Origem informada pela central",
    veiculo: t.veiculoAlocado,
    coordenadas: t.destinoCoordenadas,
    categoria: t.tipoTransporte
      ? (transporte[t.tipoTransporte] ?? "Viagem administrativa")
      : "Viagem administrativa",
    horario: t.dataHoraPretendida,
    passageiros: t.quantidadePassageiros,
    protocolo: t.protocolo,
  }));
  const grupos = new Map<string, ViagemMotorista>();
  for (const ordem of tarefas.ordens) {
    const key = ordem.veiculo?.id ?? ordem.id,
      grupo = grupos.get(key);
    if (grupo) {
      grupo.coletas = (grupo.coletas ?? 1) + 1;
      continue;
    }
    grupos.set(key, {
      id: ordem.id,
      tipo: "SVO",
      destino: ordem.chamado.enderecoOcorrencia || "Ocorrência a confirmar",
      origem: "Base de saída definida pela central",
      veiculo: ordem.veiculo,
      coordenadas: ordem.coordenadas,
      categoria: "Coletas SVO",
      coletas: 1,
    });
  }
  return [...administrativas, ...grupos.values()];
}
export function horarioViagem(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
