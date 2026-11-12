import { respostaDeErro } from "../lib/api";
import { z } from "zod";
import { api } from "./api";
import { dispararAtualizacaoNotificacoes } from "./notificacoesService";

export type StatusTriagem = "EM_ANALISE" | "APROVADO" | "RECUSADO";
export type EtapaFiltroSvo =
  "TODOS" | "EM_ANALISE" | "AGUARDANDO_ORDEM" | "EM_OPERACAO" | "ENCERRADO";
export type StatusVeiculoSvo = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";
export type EtapaColetaSvo = "EM_DESLOCAMENTO" | "NO_LOCAL" | "ENTREGUE_SVO";

export interface OrdemColetaSvo {
  id: string;
  chamadoId: string;
  veiculoId: string | null;
  motoristaId: string | null;
  status: string;
  numeroDeclaracaoObito: string | null;
  dataHoraSaida: string | null;
  dataHoraChegadaLocal?: string | null;
  dataHoraEntregaSvo?: string | null;
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
  criadoEm?: string | null;
  justificativaTriagem?: string | null;
  atendente?: { id: string; nome: string } | null;
  ordemColeta?: OrdemColetaSvo | null;
}

export interface MinhaColetaSvo extends OrdemColetaSvo {
  chamado: {
    id: string;
    numeroProtocolo: string | null;
    nomeFalecido: string | null;
    enderecoOcorrencia: string | null;
    criadoEm: string | null;
    statusTriagem: StatusTriagem;
  };
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
  tempoMedioChegadaLocalMinutos: number | null;
  tempoMedioEntregaSvoMinutos: number | null;
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
    tempoMedioChegadaLocalMinutos: z.number().nonnegative().nullable(),
    tempoMedioEntregaSvoMinutos: z.number().nonnegative().nullable(),
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
    dataHoraChegadaLocal: z.iso.datetime({ offset: true }).nullable().optional(),
    dataHoraEntregaSvo: z.iso.datetime({ offset: true }).nullable().optional(),
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
    criadoEm: z.iso.datetime({ offset: true }).nullable().optional(),
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
    throw new Error(
      "Não foi possível carregar os dados do SVO. Atualize a página e tente novamente.",
      {
        cause: { recurso, erros: resultado.error.issues },
      },
    );
  }
  return resultado.data;
}

const BASE = "/api/v1/svo";

export function extrairErroSvo(
  erro: unknown,
  padrao = "Não foi possível concluir esta ação no SVO. Tente novamente.",
): string {
  return respostaDeErro(erro, padrao);
}

const minhaColetaSvoSchema = ordemColetaSvoSchema
  .extend({
    chamado: z
      .object({
        id: z.string(),
        numeroProtocolo: z.string().nullable(),
        nomeFalecido: z.string().nullable(),
        enderecoOcorrencia: z.string().nullable(),
        criadoEm: z.iso.datetime({ offset: true }).nullable(),
        statusTriagem: z.enum(["EM_ANALISE", "APROVADO", "RECUSADO"]),
      })
      .passthrough(),
  })
  .passthrough();

export async function obterIndicadoresSvo(): Promise<IndicadoresSvo> {
  const { data } = await api.get<unknown>(`${BASE}/indicadores`);
  return validarRespostaSvo(respostaIndicadoresSvoSchema, data, "indicadores");
}

const paginaMinhasColetasSvoSchema = paginaSvoSchema(minhaColetaSvoSchema);
const STATUS_COLETA_ATIVA = ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO", "EM_DESLOCAMENTO", "NO_LOCAL"];

export async function obterMinhasColetasSvo(): Promise<MinhaColetaSvo[]> {
  const consultar = async (page: number) => {
    const { data } = await api.get<unknown>(`${BASE}/ordens-coleta/minhas`, {
      params: { page, pageSize: 100, ativas: "true" },
    });
    const pagina = validarRespostaSvo(paginaMinhasColetasSvoSchema, data, "minhas-coletas");
    if (pagina.meta.page !== page || pagina.meta.pageSize !== 100) {
      throw new Error("Não foi possível carregar todas as coletas SVO. Tente novamente.");
    }
    return pagina;
  };
  const primeira = await consultar(1);
  const ordens = new Map(primeira.data.map((ordem) => [ordem.id, ordem]));
  for (let page = 2; page <= primeira.meta.totalPages; page += 1) {
    const pagina = await consultar(page);
    for (const ordem of pagina.data) ordens.set(ordem.id, ordem);
  }
  return [...ordens.values()].filter((ordem) => STATUS_COLETA_ATIVA.includes(ordem.status));
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
  const { data } = await api.post<OrdemColetaSvo>(`${BASE}/ordens-coleta`, {
    chamadoId: id,
    ...input,
  });
  return data;
}

export async function concluirColetaSvo(id: string): Promise<OrdemColetaSvo> {
  const { data } = await api.patch<OrdemColetaSvo>(
    `${BASE}/chamados/${encodeURIComponent(id)}/concluir`,
  );
  return data;
}

export async function avancarEtapaColetaSvo(
  id: string,
  status: EtapaColetaSvo,
): Promise<OrdemColetaSvo> {
  const { data } = await api.patch<OrdemColetaSvo>(
    `${BASE}/ordens-coleta/${encodeURIComponent(id)}/etapa`,
    { status },
  );
  return data;
}

export async function cancelarOrdemColetaSvo(id: string): Promise<OrdemColetaSvo> {
  const { data } = await api.patch<OrdemColetaSvo>(
    `${BASE}/ordens-coleta/${encodeURIComponent(id)}/cancelar`,
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
      throw new Error(
        "Não foi possível carregar as escalas do SVO. Atualize a página e tente novamente.",
        { cause: { paginaSolicitada: page, paginaRecebida: resultado.meta } },
      );
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

export interface RemanejamentoSvo {
  id: string;
  criadoEm: string;
  usuario: { nome: string } | null;
  dadosNovos: {
    motivo: string;
    anterior: { placa?: string; condutor?: string };
    atual: { placa?: string; condutor?: string };
  };
}
export async function obterRemanejamentosSvo(id: string): Promise<RemanejamentoSvo[]> {
  const { data } = await api.get<RemanejamentoSvo[]>(
    `${BASE}/ordens-coleta/${encodeURIComponent(id)}/remanejamentos`,
  );
  return data;
}
export async function remanejarOrdemSvo(
  id: string,
  input: { veiculoId: string; motoristaId: string; motivo: string },
): Promise<OrdemColetaSvo> {
  const { data } = await api.patch<OrdemColetaSvo>(
    `${BASE}/ordens-coleta/${encodeURIComponent(id)}/remanejamento`,
    input,
  );
  return data;
}
