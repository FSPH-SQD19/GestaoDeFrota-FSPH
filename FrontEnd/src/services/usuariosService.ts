import { apiRequest } from "../lib/api";
import type { UserRole } from "../types/auth";

export interface UsuarioAdministrado {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  setor: string | null;
  ativo: boolean;
  criadoEm: string;
  perfis: (UserRole | "ATENDENTE_SVO")[];
}

export interface ListaUsuariosResposta {
  data: UsuarioAdministrado[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListarUsuariosParams {
  page?: number;
  pageSize?: number;
  busca?: string;
  setor?: string;
  perfil?: UserRole;
  ativo?: boolean;
}

export interface AtualizarUsuarioInput {
  nome: string;
  email: string;
  telefone: string | null;
  setor: string | null;
  perfis: UserRole[];
}

export interface CriarUsuarioInput extends AtualizarUsuarioInput {
  senha: string;
}

export interface UsuarioMutacaoResposta {
  mensagem: string;
  dados: UsuarioAdministrado;
}

export function obterUsuarioApi(id: string): Promise<UsuarioAdministrado> {
  return apiRequest<UsuarioAdministrado>(`/usuarios/${encodeURIComponent(id)}`, {});
}

export function listarUsuariosApi(
  params: ListarUsuariosParams = {},
): Promise<ListaUsuariosResposta> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.busca?.trim()) query.set("busca", params.busca.trim());
  if (params.setor?.trim()) query.set("setor", params.setor.trim());
  if (params.perfil) query.set("perfil", params.perfil);
  if (params.ativo !== undefined) query.set("ativo", String(params.ativo));
  return apiRequest<ListaUsuariosResposta>(`/usuarios?${query}`, {});
}

export function criarUsuarioApi(input: CriarUsuarioInput): Promise<UsuarioMutacaoResposta> {
  return apiRequest<UsuarioMutacaoResposta>("/usuarios", { method: "POST", data: input });
}

export function atualizarUsuarioApi(
  id: string,
  input: AtualizarUsuarioInput,
): Promise<UsuarioMutacaoResposta> {
  return apiRequest<UsuarioMutacaoResposta>(`/usuarios/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: input,
  });
}

export function inativarUsuarioApi(id: string, ativo: boolean): Promise<UsuarioMutacaoResposta> {
  if (!ativo) {
    return apiRequest<UsuarioMutacaoResposta>(`/usuarios/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  return apiRequest<UsuarioMutacaoResposta>(`/usuarios/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: { ativo: true },
  });
}
