import { apiRequest } from "../lib/api";
import type {
  AbastecimentoMotorista,
  CriarAbastecimentoMotoristaInput,
  ListaAbastecimentosResposta,
  ListarMeusAbastecimentosParams,
} from "../types/abastecimento";

export function listarMeusAbastecimentosApi(
  params: ListarMeusAbastecimentosParams = {},
): Promise<ListaAbastecimentosResposta> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 10),
  });
  if (params.veiculoId?.trim()) {
    query.set("veiculoId", params.veiculoId.trim());
  }
  return apiRequest<ListaAbastecimentosResposta>(`/abastecimentos/meus?${query}`, {});
}

export function registrarAbastecimentoMotoristaApi(
  dados: CriarAbastecimentoMotoristaInput,
): Promise<AbastecimentoMotorista> {
  return apiRequest<AbastecimentoMotorista>("/abastecimentos", {
    method: "POST",
    data: dados,
  });
}
