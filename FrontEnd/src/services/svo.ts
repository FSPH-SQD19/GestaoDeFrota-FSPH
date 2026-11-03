import axios from "axios";
import { z } from "zod";
import { api } from "./api";
import { dispararAtualizacaoNotificacoes } from "./notificacoesService";

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

export interface EscalaSvo {
  id: string;
  motorista: {
    id: string;
    nome: string | null;
    telefone: string | null;
    ativo: boolean;
  };
  veiculo: {
    id: string;
    placa: string;
    modelo: string;
    status: string;
    ativo: boolean;
  };
  inicioTurno: string;
  fimTurno: string;
  observacoes: string | null;
  encerradaEm: string | null;
  situacao: "AGENDADA" | "EM_ANDAMENTO" | "SUSPENSA" | "ENCERRADA";
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

const respostaIndicadoresSvoSchema = z
  .object({
    total: z.number().int().nonnegative(),
    emAnalise: z.number().int().nonnegative(),
    aguardandoOrdem: z.number().int().nonnegative(),
    aprovados: z.number().int().nonnegative(),
    recusados: z.number().int().nonnegative(),
    coletasEmAndamento: z.number().int().nonnegative(),
    viaturasDisponiveis: z.number().int().nonnegative(),
    totalViaturas: z.number().int().nonnegative(),
  })
  .passthrough();

const motoristaOrdemSvoSchema = z
  .object({
    id: z.string(),
    numeroCnh: z.string(),
    categoriaCnh: z.string().nullable(),
    usuario: z.object({ nome: z.string() }).nullable(),
  })
  .passthrough();

const viaturaOrdemSvoSchema = z
  .object({
    id: z.string(),
    placa: z.string(),
    modelo: z.string(),
    status: z.string(),
    capacidadeMaxima: z.number().int().nonnegative(),
  })
  .passthrough();

const ordemColetaSvoSchema = z
  .object({
    id: z.string(),
    chamadoId: z.string(),
    veiculoId: z.string().nullable(),
    motoristaId: z.string().nullable(),
    status: z.string(),
    numeroDeclaracaoObito: z.string().nullable(),
    dataHoraSaida: z.iso.datetime({ offset: true }).nullable(),
    veiculo: viaturaOrdemSvoSchema.nullable().optional(),
    motorista: motoristaOrdemSvoSchema.nullable().optional(),
  })
  .passthrough();

const chamadoSvoSchema = z
  .object({
    id: z.string(),
    numeroProtocolo: z.string().nullable(),
    atendenteId: z.string().nullable(),
    nomeFalecido: z.string().nullable(),
    enderecoOcorrencia: z.string().nullable(),
    relatoOcorrencia: z.string().nullable(),
    statusTriagem: z.enum(["EM_ANALISE", "APROVADO", "RECUSADO"]),
    justificativaTriagem: z.string().nullable().optional(),
    atendente: z.object({ id: z.string(), nome: z.string() }).nullable().optional(),
    ordemColeta: ordemColetaSvoSchema.nullable().optional(),
  })
  .passthrough();

const metadadosPaginacaoSvoSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .passthrough();

function paginaSvoSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      data: z.array(itemSchema),
      meta: metadadosPaginacaoSvoSchema,
    })
    .passthrough();
}

const paginaChamadosSvoSchema = paginaSvoSchema(chamadoSvoSchema);

const motoristaSvoSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    numeroCnh: z.string(),
    categoriaCnh: z.string().nullable(),
    usuario: z.object({ nome: z.string() }).nullable(),
  })
  .passthrough();

const viaturaSvoSchema = z
  .object({
    id: z.string(),
    placa: z.string(),
    modelo: z.string(),
    status: z.string(),
    capacidadeMaxima: z.number().int().nonnegative(),
    ativo: z.boolean(),
    ocupacaoAtual: z.number().int().nonnegative(),
    motoristaAtual: z.object({ id: z.string(), nome: z.string().nullable() }).nullable(),
  })
  .passthrough();

const escalaSvoSchema = z
  .object({
    id: z.string(),
    motorista: z
      .object({
        id: z.string(),
        nome: z.string().nullable(),
        telefone: z.string().nullable(),
        ativo: z.boolean(),
      })
      .passthrough(),
    veiculo: z
      .object({
        id: z.string(),
        placa: z.string(),
        modelo: z.string(),
        status: z.string(),
        ativo: z.boolean(),
      })
      .passthrough(),
    inicioTurno: z.iso.datetime({ offset: true }),
    fimTurno: z.iso.datetime({ offset: true }),
    observacoes: z.string().nullable(),
    encerradaEm: z.iso.datetime({ offset: true }).nullable(),
    situacao: z.enum(["AGENDADA", "EM_ANDAMENTO", "SUSPENSA", "ENCERRADA"]),
  })
  .passthrough();

const paginaEscalasSvoSchema = paginaSvoSchema(escalaSvoSchema);

function validarRespostaSvo<T extends z.ZodType>(
  schema: T,
  resposta: unknown,
  recurso: string,
): z.output<T> {
  const resultado = schema.safeParse(resposta);
  if (!resultado.success) {
    const camposInvalidos = resultado.error.issues
      .map((issue) => issue.path.map(String).join(".") || "resposta")
      .filter((campo, indice, campos) => campos.indexOf(campo) === indice)
      .slice(0, 5)
      .join(", ");
    const complemento = camposInvalidos ? `: ${camposInvalidos}` : "";
    throw new Error(`Resposta inesperada da API do SVO (${recurso})${complemento}.`);
  }
  return resultado.data;
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
  const { data } = await api.get<unknown>(`${BASE}/indicadores`);
  return validarRespostaSvo(respostaIndicadoresSvoSchema, data, "indicadores");
}

export async function obterChamadosSvo(params?: {
  status?: StatusTriagem;
  etapa?: EtapaFiltroSvo;
  busca?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginaChamadosSvo> {
  const { data } = await api.get<unknown>(`${BASE}/chamados`, { params });
  return validarRespostaSvo(paginaChamadosSvoSchema, data, "chamados");
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
  dispararAtualizacaoNotificacoes();
  return data;
}

export async function obterViaturasSvo(): Promise<ViaturaSvo[]> {
  const { data } = await api.get<unknown>(`${BASE}/viaturas`);
  return validarRespostaSvo(z.array(viaturaSvoSchema), data, "viaturas");
}

export async function obterMotoristasSvo(): Promise<MotoristaSvo[]> {
  const { data } = await api.get<unknown>(`${BASE}/motoristas`);
  return validarRespostaSvo(z.array(motoristaSvoSchema), data, "motoristas");
}

export async function obterEscalasEmAndamentoSvo(): Promise<EscalaSvo[]> {
  const pageSize = 100;
  const consultarPagina = async (page: number) => {
    const { data } = await api.get<unknown>(`${BASE}/escalas`, {
      params: { situacao: "EM_ANDAMENTO", page, pageSize },
    });
    const resultado = validarRespostaSvo(paginaEscalasSvoSchema, data, "escalas");
    if (resultado.meta.page !== page || resultado.meta.pageSize !== pageSize) {
      throw new Error(`Resposta inesperada da API do SVO (escalas): paginação da página ${page}.`);
    }
    return resultado;
  };

  const primeiraPagina = await consultarPagina(1);
  const escalasPorId = new Map(primeiraPagina.data.map((escala) => [escala.id, escala]));

  for (let page = 2; page <= primeiraPagina.meta.totalPages; page += 1) {
    const pagina = await consultarPagina(page);
    for (const escala of pagina.data) {
      escalasPorId.set(escala.id, escala);
    }
  }

  return [...escalasPorId.values()];
}
