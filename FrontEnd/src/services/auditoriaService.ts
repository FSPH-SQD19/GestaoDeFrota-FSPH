import { apiRequest } from "../lib/api";
import type { FiltrosAuditoria, ListaAuditoriaResposta } from "../types/auditoria";

export function listarAuditoriaApi(
  params: FiltrosAuditoria = {},
): Promise<ListaAuditoriaResposta> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.tabelaAfetada?.trim() && params.tabelaAfetada !== "TODAS") {
    query.set("tabelaAfetada", params.tabelaAfetada.trim());
  }
  if (params.acao?.trim() && params.acao !== "TODAS") {
    query.set("acao", params.acao.trim());
  }
  if (params.usuarioId?.trim() && params.usuarioId !== "TODOS") {
    query.set("usuarioId", params.usuarioId.trim());
  }
  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }
  if (params.dataInicio?.trim()) {
    query.set("dataInicio", params.dataInicio.trim());
  }
  if (params.dataFim?.trim()) {
    query.set("dataFim", params.dataFim.trim());
  }

  return apiRequest<ListaAuditoriaResposta>(`/auditoria?${query}`, {});
}
