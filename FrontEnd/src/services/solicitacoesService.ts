import { apiRequest } from "../lib/api";
import type {
  ListarSolicitacoesParams,
  ListaSolicitacoesResposta,
  NovaSolicitacaoViagem,
  SolicitacaoViagem,
} from "../types/solicitacao";

export function listarSolicitacoesApi(
  params: ListarSolicitacoesParams = {},
): Promise<ListaSolicitacoesResposta> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.status?.length) query.set("status", params.status.join(","));
  if (params.urgencia) query.set("urgencia", params.urgencia);
  if (params.tipoTransporte) query.set("tipoTransporte", params.tipoTransporte);
  if (params.setorOrigem?.trim()) query.set("setorOrigem", params.setorOrigem.trim());
  if (params.busca?.trim()) query.set("busca", params.busca.trim());
  return apiRequest<ListaSolicitacoesResposta>(`/solicitacoes?${query}`, {});
}
export function criarSolicitacaoApi(dados: NovaSolicitacaoViagem): Promise<SolicitacaoViagem> {
  return apiRequest<SolicitacaoViagem>("/solicitacoes", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}
