import type { ChamadoSvo, EtapaFiltroSvo, MotoristaSvo, ViaturaSvo } from "../../services/svo";

type StatusOperacionalChamado =
  "EM_ANALISE" | "AGUARDANDO_ORDEM" | "EM_OPERACAO" | "CONCLUIDO" | "RECUSADO";

export const FILTROS: { id: EtapaFiltroSvo; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "EM_ANALISE", label: "Aguardando triagem" },
  { id: "AGUARDANDO_ORDEM", label: "Aguardando ordem" },
  { id: "EM_OPERACAO", label: "Em operação" },
  { id: "ENCERRADO", label: "Encerrados" },
];

export const STATUS_CHAMADO_LABEL: Record<StatusOperacionalChamado, string> = {
  EM_ANALISE: "Aguardando triagem",
  AGUARDANDO_ORDEM: "Triagem aprovada",
  EM_OPERACAO: "Em coleta",
  CONCLUIDO: "Coleta concluída",
  RECUSADO: "Recusado na triagem",
};

export const STATUS_CHAMADO_VARIANT: Record<
  StatusOperacionalChamado,
  "warning" | "info" | "success" | "neutral" | "danger"
> = {
  EM_ANALISE: "warning",
  AGUARDANDO_ORDEM: "info",
  EM_OPERACAO: "success",
  CONCLUIDO: "neutral",
  RECUSADO: "danger",
};

export function classificarChamado(chamado: ChamadoSvo): StatusOperacionalChamado {
  if (chamado.statusTriagem === "EM_ANALISE") return "EM_ANALISE";
  if (chamado.statusTriagem === "RECUSADO") return "RECUSADO";
  if (!chamado.ordemColeta) return "AGUARDANDO_ORDEM";
  if (["CONCLUIDA", "ENTREGUE_SVO"].includes(chamado.ordemColeta.status)) return "CONCLUIDO";
  return "EM_OPERACAO";
}

export function rotuloStatusViatura(status: string): {
  label: string;
  variant: "success" | "info" | "warning" | "neutral" | "danger";
} {
  if (status === "DISPONIVEL") return { label: "Disponível", variant: "success" };
  if (status === "EM_VIAGEM") return { label: "Em coleta", variant: "info" };
  if (status === "DESINFECCAO") return { label: "Em desinfecção", variant: "warning" };
  if (status === "MANUTENCAO") return { label: "Em manutenção", variant: "danger" };
  return { label: status, variant: "neutral" };
}

export function nomeMotorista(motorista: MotoristaSvo): string {
  const nome = motorista.usuario?.nome?.trim();
  return nome ? `${nome} (CNH ${motorista.numeroCnh})` : `CNH ${motorista.numeroCnh}`;
}

export function motoristaElegivelParaViatura(
  motorista: MotoristaSvo,
  viatura: ViaturaSvo | undefined,
): boolean {
  if (motorista.status === "DISPONIVEL") return true;
  return (
    motorista.status === "OCUPADO" &&
    viatura?.status === "EM_VIAGEM" &&
    viatura.motoristaAtual?.id === motorista.id
  );
}

export function formatarHorarioTurno(inicio: string, fim: string): string {
  const formato = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formato.format(new Date(inicio))} – ${formato.format(new Date(fim))}`;
}

export function viaturaElegivel(viatura: ViaturaSvo): boolean {
  return (
    (viatura.status === "DISPONIVEL" || viatura.status === "EM_VIAGEM") &&
    viatura.ocupacaoAtual < viatura.capacidadeMaxima
  );
}
