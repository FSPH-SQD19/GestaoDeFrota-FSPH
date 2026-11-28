import type {
  ChamadoSvo,
  EtapaColetaSvo,
  EtapaFiltroSvo,
  MotoristaSvo,
  ViaturaSvo,
} from "../../services/svo";

type StatusOperacionalChamado =
  | "EM_ANALISE"
  | "AGUARDANDO_ORDEM"
  | "AGUARDANDO_DESPACHO"
  | "EM_OPERACAO"
  | "NO_LOCAL"
  | "CONCLUIDO"
  | "RECUSADO"
  | "CANCELADO";

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
  AGUARDANDO_DESPACHO: "Aguardando despacho",
  EM_OPERACAO: "Em coleta",
  NO_LOCAL: "No local da ocorrência",
  CONCLUIDO: "Coleta concluída",
  RECUSADO: "Recusado na triagem",
  CANCELADO: "Ordem cancelada",
};

export const STATUS_CHAMADO_VARIANT: Record<
  StatusOperacionalChamado,
  "warning" | "info" | "success" | "neutral" | "danger"
> = {
  EM_ANALISE: "warning",
  AGUARDANDO_ORDEM: "info",
  AGUARDANDO_DESPACHO: "warning",
  EM_OPERACAO: "success",
  NO_LOCAL: "info",
  CONCLUIDO: "neutral",
  RECUSADO: "danger",
  CANCELADO: "neutral",
};

export function classificarChamado(
  chamado: ChamadoSvo & { statusOperacao?: string | null },
): StatusOperacionalChamado {
  if (chamado.statusTriagem === "EM_ANALISE") return "EM_ANALISE";
  if (chamado.statusTriagem === "RECUSADO") return "RECUSADO";

  const statusOrdem = chamado.ordemColeta?.status ?? chamado.statusOperacao ?? null;
  if (!statusOrdem) return "AGUARDANDO_ORDEM";
  if (statusOrdem === "AGUARDANDO_DESPACHO") return "AGUARDANDO_DESPACHO";
  if (statusOrdem === "NO_LOCAL") return "NO_LOCAL";
  if (statusOrdem === "CANCELADA") return "CANCELADO";
  if (["CONCLUIDA", "ENTREGUE_SVO"].includes(statusOrdem)) return "CONCLUIDO";
  return "EM_OPERACAO";
}

export function rotuloEtapaHistoricoSvo(etapa: string): string {
  switch (etapa) {
    case "ENVIADO":
      return "Solicitação enviada";
    case "TRIAGEM_APROVADO":
      return "Triagem aprovada";
    case "TRIAGEM_RECUSADO":
      return "Triagem recusada";
    case "COMPLEMENTACAO":
      return "Complementação registrada";
    case "ORDEM_EMITIDA":
      return "Ordem de coleta emitida";
    case "ORDEM_EM_DESLOCAMENTO":
      return "Equipe em deslocamento";
    case "ORDEM_NO_LOCAL":
      return "Equipe no local";
    case "ORDEM_ENTREGUE_SVO":
      return "Concluído / Entregue ao SVO";
    case "ORDEM_CANCELADA":
      return "Ordem cancelada";
    default:
      return etapa.replaceAll("_", " ");
  }
}

export function proximaEtapaColeta(
  status: string,
): { status: EtapaColetaSvo; label: string } | null {
  if (status === "AGUARDANDO_DESPACHO")
    return { status: "EM_DESLOCAMENTO", label: "Registrar saída" };
  if (status === "EM_DESLOCAMENTO" || status === "EM_ANDAMENTO")
    return { status: "NO_LOCAL", label: "Registrar chegada ao local" };
  if (status === "NO_LOCAL") return { status: "ENTREGUE_SVO", label: "Registrar entrega ao SVO" };
  return null;
}

export function formatarDataHoraColeta(valor: string | null | undefined): string {
  return valor
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(valor))
    : "Não registrada";
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
    (viatura?.status === "EM_VIAGEM" || viatura?.status === "DISPONIVEL") &&
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
