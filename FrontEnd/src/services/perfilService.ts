import { apiRequest } from "../lib/api";

export interface AlterarMinhaSenhaPayload {
  senhaAtual: string;
  novaSenha: string;
}

export interface RedefinirSenhaAdminPayload {
  novaSenha: string;
}

export interface RespostaMensagem {
  mensagem: string;
}

export function alterarMinhaSenhaApi(payload: AlterarMinhaSenhaPayload): Promise<RespostaMensagem> {
  return apiRequest<RespostaMensagem>("/auth/alterar-senha", {
    method: "PATCH",
    data: payload,
  });
}

export function redefinirSenhaUsuarioApi(
  usuarioId: string,
  payload: RedefinirSenhaAdminPayload,
): Promise<RespostaMensagem> {
  return apiRequest<RespostaMensagem>(
    `/auth/usuarios/${encodeURIComponent(usuarioId)}/redefinir-senha`,
    {
      method: "PATCH",
      data: payload,
    },
  );
}
