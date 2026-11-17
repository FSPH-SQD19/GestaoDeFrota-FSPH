import { api } from "./api";
import type {
  AtualizarMultaPayload,
  CriarMultaPayload,
  Multa,
  ResumoMultasMotorista,
} from "../types/multa";

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
