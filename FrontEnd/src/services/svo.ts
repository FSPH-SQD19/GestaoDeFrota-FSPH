import axios from "axios";
import { api } from "./api";

export type StatusTriagem = "EM_ANALISE" | "APROVADO" | "RECUSADO";
export type EtapaFiltroSvo =
  "TODOS" | "EM_ANALISE" | "AGUARDANDO_ORDEM" | "EM_OPERACAO" | "ENCERRADO";
export type StatusVeiculoSvo = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";

export interface OrdemColetaSvo {
  id: string;
  chamadoId: string;
  veiculoId: string | null;
  motoristaId: string | null;
  status: string;
  numeroDeclaracaoObito: string | null;
  dataHoraSaida: string | null;
  veiculo?: {
    id: string;
    placa: string;
    modelo: string;
    status: string;
    capacidadeMaxima: number;
  } | null;
  motorista?: {
    id: string;
    numeroCnh: string;
    categoriaCnh: string | null;
    usuario: { nome: string } | null;
  } | null;
}

export interface ChamadoSvo {
  id: string;
  numeroProtocolo: string | null;
  atendenteId: string | null;
  nomeFalecido: string | null;
  enderecoOcorrencia: string | null;
  relatoOcorrencia: string | null;
  statusTriagem: StatusTriagem;
  justificativaTriagem?: string | null;
  atendente?: { id: string; nome: string } | null;
  ordemColeta?: OrdemColetaSvo | null;
}

export interface ViaturaSvo {
  id: string;
  placa: string;
  modelo: string;
  status: StatusVeiculoSvo | string;
  capacidadeMaxima: number;
  ativo: boolean;
  ocupacaoAtual: number;
  motoristaAtual: {
    id: string;
    nome: string | null;
  } | null;
}

export interface MotoristaSvo {
  id: string;
  status?: string;
  numeroCnh: string;
  categoriaCnh: string | null;
  usuario: { nome: string } | null;
}

export interface IndicadoresSvo {
  total: number;
  emAnalise: number;
  aguardandoOrdem: number;
  aprovados: number;
  recusados: number;
  coletasEmAndamento: number;
  viaturasDisponiveis: number;
  totalViaturas: number;
}

export interface PaginaChamadosSvo {
  data: ChamadoSvo[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ErroApiCorpo {
  message?: string;
  mensagem?: string;
  error?: string;
  errors?: Array<{ campo?: string; mensagem?: string } | string>;
}

const BASE = "/api/v1/svo";

export function extrairErroSvo(
  erro: unknown,
  padrao = "Falha ao processar operação no SVO.",
): string {
  if (axios.isAxiosError(erro)) {
    const corpo = erro.response?.data as ErroApiCorpo | undefined;
    if (Array.isArray(corpo?.errors) && corpo.errors.length > 0) {
      const mensagens = corpo.errors
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item.mensagem === "string") return item.mensagem.trim();
          return "";
        })
        .filter(Boolean);
      if (mensagens.length > 0) {
        return mensagens.join(" ");
      }
    }
    if (typeof corpo?.message === "string" && corpo.message.trim()) return corpo.message.trim();
    if (typeof corpo?.mensagem === "string" && corpo.mensagem.trim()) return corpo.mensagem.trim();
    if (typeof corpo?.error === "string" && corpo.error.trim()) return corpo.error.trim();
  }
  if (erro instanceof Error && erro.message.trim()) return erro.message.trim();
  return padrao;
}

export async function obterIndicadoresSvo(): Promise<IndicadoresSvo> {
  const { data } = await api.get<IndicadoresSvo>(`${BASE}/indicadores`);
  return data;
}

export async function obterChamadosSvo(params?: {
  status?: StatusTriagem;
  etapa?: EtapaFiltroSvo;
  busca?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginaChamadosSvo> {
  const { data } = await api.get<PaginaChamadosSvo>(`${BASE}/chamados`, { params });
  return data;
}

export async function criarChamadoSvo(input: {
  nomeFalecido: string;
  enderecoOcorrencia: string;
  relatoOcorrencia: string;
}): Promise<ChamadoSvo> {
  const { data } = await api.post<ChamadoSvo>(`${BASE}/chamados`, input);
  return data;
}

export async function triarChamadoSvo(
  id: string,
  input: {
    decisao: "APROVAR" | "RECUSAR";
    justificativa?: string;
  },
): Promise<ChamadoSvo> {
  const { data } = await api.patch<ChamadoSvo>(
    `${BASE}/chamados/${encodeURIComponent(id)}/triagem`,
    input,
  );
  return data;
}

export async function criarOrdemColetaSvo(
  id: string,
  input: {
    veiculoId: string;
    motoristaId: string;
    numeroDeclaracaoObito?: string;
  },
): Promise<OrdemColetaSvo> {
  const { data } = await api.post<OrdemColetaSvo>(
    `${BASE}/chamados/${encodeURIComponent(id)}/ordens`,
    input,
  );
  return data;
}

export async function concluirColetaSvo(id: string): Promise<OrdemColetaSvo> {
  const { data } = await api.patch<OrdemColetaSvo>(
    `${BASE}/chamados/${encodeURIComponent(id)}/concluir`,
  );
  return data;
}

export async function concluirDesinfeccaoSvo(veiculoId: string): Promise<ViaturaSvo> {
  const { data } = await api.patch<ViaturaSvo>(
    `${BASE}/viaturas/${encodeURIComponent(veiculoId)}/desinfeccao`,
  );
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
