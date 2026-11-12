import { apiRequest } from "../lib/api";
import { dispararAtualizacaoNotificacoes } from "./notificacoesService";
import type {
  ConcluirViagemInput,
  ExecucaoViagemResposta,
  IniciarViagemInput,
  ListaSolicitacoesResposta,
  ListaMinhasViagensResposta,
  ListarSolicitacoesParams,
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

export function listarMinhasViagensApi(
  params: ListarSolicitacoesParams = {},
): Promise<ListaMinhasViagensResposta> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.status?.length) query.set("status", params.status.join(","));
  return apiRequest<ListaMinhasViagensResposta>(`/solicitacoes/minhas?${query}`, {});
}

export async function criarSolicitacaoApi(
  dados: NovaSolicitacaoViagem,
): Promise<SolicitacaoViagem> {
  const criada = await apiRequest<SolicitacaoViagem>("/solicitacoes", {
    method: "POST",
    data: dados,
  });
  dispararAtualizacaoNotificacoes();
  return criada;
}

export function iniciarViagemApi(
  id: string,
  dados: IniciarViagemInput,
): Promise<ExecucaoViagemResposta> {
  return apiRequest<ExecucaoViagemResposta>(`/solicitacoes/${encodeURIComponent(id)}/iniciar`, {
    method: "POST",
    data: dados,
  });
}

export function concluirViagemApi(
  id: string,
  dados: ConcluirViagemInput,
): Promise<ExecucaoViagemResposta> {
  return apiRequest<ExecucaoViagemResposta>(`/solicitacoes/${encodeURIComponent(id)}/concluir`, {
    method: "POST",
    data: dados,
  });
}

export async function cancelarSolicitacaoApi(
  id: string,
  motivoCancelamento: string,
): Promise<{ mensagem: string; dados: SolicitacaoViagem }> {
  const resposta = await apiRequest<{ mensagem: string; dados: SolicitacaoViagem }>(
    `/solicitacoes/${encodeURIComponent(id)}/cancelar`,
    {
      method: "PATCH",
      data: { motivoCancelamento },
    },
  );
  dispararAtualizacaoNotificacoes();
  return resposta;
}
