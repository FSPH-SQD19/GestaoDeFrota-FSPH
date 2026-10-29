import { api } from "./api";

export type StatusTriagem = "EM_ANALISE" | "APROVADO" | "RECUSADO";
export type StatusVeiculoSvo = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";

export interface OrdemColetaSvo {
  id: string;
  chamadoId: string;
  veiculoId: string | null;
  motoristaId: string | null;
  status: string;
  numeroDeclaracaoObito: string | null;
  dataHoraSaida: string | null;
}
export interface ChamadoSvo {
  id: string;
  numeroProtocolo: string | null;
  atendenteId: string | null;
  nomeFalecido: string | null;
  enderecoOcorrencia: string | null;
  relatoOcorrencia: string | null;
  statusTriagem: StatusTriagem;
  ordemColeta?: OrdemColetaSvo | null;
}
export interface ViaturaSvo {
  id: string;
  placa: string;
  modelo: string;
  status: StatusVeiculoSvo;
  capacidadeMaxima: number;
  ativo: boolean;
}
export interface MotoristaSvo {
  id: string;
  numeroCnh: string;
  categoriaCnh: string | null;
  usuario: { nome: string } | null;
}
export interface IndicadoresSvo {
  total: number;
  emAnalise: number;
  aprovados: number;
  recusados: number;
  coletasEmAndamento: number;
  viaturasDisponiveis: number;
}
export interface PaginaChamadosSvo {
  data: ChamadoSvo[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
const BASE = "/api/v1/svo";

export async function obterIndicadoresSvo(): Promise<IndicadoresSvo> {
  const { data } = await api.get<IndicadoresSvo>(`${BASE}/indicadores`);
  return data;
}
export async function obterChamadosSvo(params?: { status?: StatusTriagem; page?: number; pageSize?: number }): Promise<PaginaChamadosSvo> {
  const { data } = await api.get<PaginaChamadosSvo>(`${BASE}/chamados`, { params });
  return data;
}
export async function criarChamadoSvo(input: {
  nomeFalecido: string; enderecoOcorrencia: string; relatoOcorrencia: string;
}): Promise<ChamadoSvo> {
  const { data } = await api.post<ChamadoSvo>(`${BASE}/chamados`, input);
  return data;
}
export async function triarChamadoSvo(id: string, input: {
  decisao: "APROVAR" | "RECUSAR"; justificativa?: string;
}): Promise<ChamadoSvo> {
  const { data } = await api.patch<ChamadoSvo>(`${BASE}/chamados/${encodeURIComponent(id)}/triagem`, input);
  return data;
}
export async function criarOrdemColetaSvo(id: string, input: {
  veiculoId: string; motoristaId: string; numeroDeclaracaoObito?: string;
}): Promise<OrdemColetaSvo> {
  const { data } = await api.post<OrdemColetaSvo>(`${BASE}/chamados/${encodeURIComponent(id)}/ordens`, input);
  return data;
}
export async function obterViaturasSvo(): Promise<ViaturaSvo[]> {
  const { data } = await api.get<ViaturaSvo[]>(`${BASE}/viaturas`);
  return data;
}
export async function obterMotoristasSvo(): Promise<MotoristaSvo[]> {
  const { data } = await api.get<MotoristaSvo[]>(`${BASE}/motoristas`);
  return data;
}
