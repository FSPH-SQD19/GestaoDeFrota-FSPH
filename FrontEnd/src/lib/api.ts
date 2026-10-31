import axios, { type AxiosRequestConfig, type Method } from "axios";
import { api } from "../services/api";

interface ApiRequestOptions {
  method?: Method;
  body?: string;
}

function respostaDeErro(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (body && typeof body === "object") {
      const details = body as Record<string, unknown>;
      if (Array.isArray(details.errors)) {
        const mensagens = details.errors.flatMap((item: unknown) => {
          if (typeof item === "string" && item.trim()) return [item.trim()];
          if (
            item &&
            typeof item === "object" &&
            "mensagem" in item &&
            typeof item.mensagem === "string" &&
            item.mensagem.trim()
          )
            return [item.mensagem.trim()];
          return [];
        });
        if (mensagens.length) return mensagens.join(" ");
      }
      const message = [details.error, details.mensagem, details.message].find(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      if (message) return message;
    }
    if (error.response?.status === 401) return "Sua sessão expirou. Entre novamente.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível concluir a operação.";
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let data: unknown;
  if (options.body) {
    try {
      data = JSON.parse(options.body);
    } catch {
      throw new Error("O corpo da requisição não contém JSON válido.");
    }
  }

  const config: AxiosRequestConfig = {
    url: `/api/v1${path.startsWith("/") ? path : `/${path}`}`,
    method: options.method ?? "GET",
    data,
  };

  try {
    const response = await api.request<T>(config);
    return response.data;
  } catch (error) {
    throw new Error(respostaDeErro(error));
  }
}
