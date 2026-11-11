import { apiRequest } from "../lib/api";

export type AlteracaoProgramacao = {
  id: string;
  acao: "PROGRAMAR" | "REAGENDAR" | "CANCELAR";
  criadoEm: string;
  autor: string;
  dados: {
    anterior: { inicioPrevisto: string; fimPrevisto: string } | null;
    atual: { inicioPrevisto: string; fimPrevisto: string };
  };
};
export type Programacao = {
  id: string;
  veiculoId: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  fornecedorId: string | null;
  fornecedor: { razaoSocial: string } | null;
  descricao: string | null;
  status: "PROGRAMADA" | "CANCELADA";
  versao: number;
  historico: AlteracaoProgramacao[];
};
export type ProgramacaoInput = {
  veiculoId: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  fornecedorId: string | null;
  descricao: string | null;
};
export type ConflitosProgramacao = {
  viagens: {
    id: string;
    protocolo: string;
    status: string;
    dataHoraPretendida: string;
    dataHoraRetornoPrevista: string;
  }[];
  manutencoes: { id: string; inicioPrevisto: string; fimPrevisto: string }[];
};
export const EVENTO_OCUPACAO = "frota:ocupacao-atualizada";
export const atualizarOcupacao = () => window.dispatchEvent(new Event(EVENTO_OCUPACAO));

export function listarProgramacoes(veiculoId: string, page: number) {
  return apiRequest<{ data: Programacao[]; meta: { totalPages: number; total: number } }>(
    `/manutencoes/programacoes?${new URLSearchParams({ veiculoId, page: String(page) })}`,
  );
}
export function consultarConflitos(dados: ProgramacaoInput, ignorarId?: string) {
  return apiRequest<ConflitosProgramacao>("/manutencoes/programacoes/conflitos", {
    method: "POST",
    data: { ...dados, ignorarId },
  });
}
export async function salvarProgramacao(dados: ProgramacaoInput, existente?: Programacao) {
  await apiRequest(
    existente ? `/manutencoes/${existente.id}/reagendar` : "/manutencoes/programacoes",
    {
      method: existente ? "PATCH" : "POST",
      data: existente ? { ...dados, versao: existente.versao } : dados,
    },
  );
  atualizarOcupacao();
}
export async function cancelarProgramacao(programacao: Programacao) {
  await apiRequest(`/manutencoes/${programacao.id}/cancelar`, {
    method: "PATCH",
    data: { versao: programacao.versao },
  });
  atualizarOcupacao();
}

export const formatarDataHora = (data: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
export const formatarPeriodo = (inicio: string, fim: string) =>
  `${formatarDataHora(inicio)} até ${formatarDataHora(fim)}`;

export function dataHoraDoFormulario(data: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date(data))
    .replace(" ", "T");
}
export const dataHoraParaApi = (data: string) => new Date(`${data}:00-03:00`).toISOString();
