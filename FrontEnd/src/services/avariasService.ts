import { apiRequest } from "../lib/api";

export type SituacaoAvaria = "PENDENTE" | "LIBERADA" | "ENCAMINHADA_MANUTENCAO";
export type DecisaoAvaria = "LIBERAR" | "ENCAMINHAR_MANUTENCAO";

export interface VeiculoAvariaFiltro {
  id: string;
  placa: string;
  modelo: string;
}

export interface AvariaViagem {
  id: string;
  solicitacaoId: string;
  execucaoId: string;
  veiculoId: string;
  registradaPorId: string;
  analisadaPorId: string | null;
  descricao: string;
  situacao: SituacaoAvaria;
  criadaEm: string;
  analisadaEm: string | null;
  justificativa: string | null;
  veiculo: { id: string; placa: string; modelo: string; status: string; ativo: boolean };
  solicitacao: { id: string; protocolo: string; origem: string | null; destino: string | null };
  registradaPor: { id: string; nome: string };
  analisadaPor: { id: string; nome: string } | null;
  manutencao: { id: string; tipo: string | null; status: string; descricao: string | null } | null;
}

export interface HistoricoAvaria {
  id: string;
  situacaoAnterior: string | null;
  situacaoNova: string;
  justificativa: string | null;
  criadoEm: string;
  autor: { id: string; nome: string };
  manutencao: { id: string; status: string; descricao: string | null } | null;
}

export interface ListaAvarias {
  data: AvariaViagem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listarAvarias(params: {
  page: number;
  pageSize: number;
  veiculoId?: string;
  situacao?: SituacaoAvaria;
}): Promise<ListaAvarias> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.veiculoId) query.set("veiculoId", params.veiculoId);
  if (params.situacao) query.set("situacao", params.situacao);
  return apiRequest<ListaAvarias>(`/avarias?${query.toString()}`);
}

export async function listarVeiculosComAvaria(): Promise<VeiculoAvariaFiltro[]> {
  const resposta = await apiRequest<{ data: VeiculoAvariaFiltro[] }>("/avarias/veiculos");
  return resposta.data;
}

export async function obterHistoricoAvaria(id: string): Promise<HistoricoAvaria[]> {
  const resposta = await apiRequest<{ data: HistoricoAvaria[] }>(
    `/avarias/${encodeURIComponent(id)}/historico`,
  );
  return resposta.data;
}

export async function analisarAvariaApi(
  id: string,
  input: { decisao: DecisaoAvaria; justificativa: string },
): Promise<AvariaViagem> {
  return apiRequest<AvariaViagem>(`/avarias/${encodeURIComponent(id)}/analisar`, {
    method: "PATCH",
    data: input,
  });
}
