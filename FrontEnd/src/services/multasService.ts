import { api } from "./api";
import type {
  AtualizarMultaPayload,
  CriarMultaPayload,
  ListarMultasResponse,
  Multa,
  ResumoMultasMotorista,
} from "../types/multa";

export async function listarMultasApi(params?: {
  page?: number;
  pageSize?: number;
  busca?: string;
  veiculoId?: string;
  motoristaId?: string;
  status?: string;
  gravidade?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<ListarMultasResponse> {
  const { data } = await api.get<ListarMultasResponse>("/api/v1/multas", { params });
  return data;
}

export async function obterMultaApi(id: string): Promise<Multa> {
  const { data } = await api.get<Multa>(`/api/v1/multas/${encodeURIComponent(id)}`);
  return data;
}

export async function criarMultaApi(payload: CriarMultaPayload): Promise<Multa> {
  const { data } = await api.post<Multa>("/api/v1/multas", payload);
  return data;
}

export async function atualizarMultaApi(
  id: string,
  payload: AtualizarMultaPayload,
): Promise<Multa> {
  const { data } = await api.patch<Multa>(`/api/v1/multas/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function obterMultasMotoristaApi(motoristaId: string): Promise<ResumoMultasMotorista> {
  const { data } = await api.get<ResumoMultasMotorista>(
    `/api/v1/multas/motorista/${encodeURIComponent(motoristaId)}`,
  );
  return data;
}
