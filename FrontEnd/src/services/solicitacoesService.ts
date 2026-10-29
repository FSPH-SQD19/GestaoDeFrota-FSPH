import type {
  AprovarSolicitacaoInput,
  ContagemPorStatus,
  ListarSolicitacoesParams,
  ListaSolicitacoesResposta,
  MotoristaDisponivelOption,
  NovaSolicitacaoViagem,
  RecusarSolicitacaoInput,
  SolicitacaoViagem,
  StatusSolicitacao,
  TipoTransporte,
  UrgenciaSolicitacao,
  VeiculoDisponivelOption,
} from "../types/solicitacao";

const DEFAULT_API_URL = "http://localhost:3000";
const STORAGE_KEY_TOKEN = "@fsph_frota_token";

function obterApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return DEFAULT_API_URL;
}

function obterToken(tokenExplicito?: string | null): string | null {
  if (tokenExplicito) return tokenExplicito;
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

export function montarHeaders(tokenExplicito?: string | null): HeadersInit {
  const token = obterToken(tokenExplicito);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface ErroDetalheApi {
  campo?: string;
  mensagem?: string;
}

interface ErroApi {
  error?: string;
  message?: string;
  mensagem?: string;
  errors?: Array<ErroDetalheApi | string>;
  details?: string[];
}

export async function extrairErroApi(response: Response, mensagemPadrao: string): Promise<string> {
  try {
    const corpo = (await response.json()) as ErroApi;
    if (Array.isArray(corpo.errors) && corpo.errors.length > 0) {
      const mensagens = corpo.errors
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item.mensagem === "string" && item.mensagem.trim()) {
            return item.mensagem.trim();
          }
          return "";
        })
        .filter(Boolean);

      if (mensagens.length > 0) {
        return mensagens.join(" ");
      }
    }
    if (Array.isArray(corpo.details) && corpo.details.length > 0 && corpo.details[0]) {
      return corpo.details[0];
    }
    if (typeof corpo.error === "string" && corpo.error.trim()) {
      return corpo.error;
    }
    if (typeof corpo.mensagem === "string" && corpo.mensagem.trim()) {
      return corpo.mensagem;
    }
    if (typeof corpo.message === "string" && corpo.message.trim()) {
      return corpo.message;
    }
  } catch {
    // Resposta sem JSON válido; usa mensagem padrão.
  }
  return mensagemPadrao;
}

interface SolicitacaoApiRaw {
  id: string;
  protocolo: string;
  solicitanteId?: string;
  solicitanteNome?: string;
  setorOrigem: string;
  origem: string;
  destino: string;
  dataHoraPretendida: string;
  dataHoraRetornoPrevista?: string | null;
  quantidadePassageiros: number;
  tipoTransporte: TipoTransporte;
  urgencia: UrgenciaSolicitacao;
  justificativa: string;
  observacoes?: string | null;
  status: StatusSolicitacao;
  criadoEm: string;
  motivoRecusa?: string | null;
  veiculoAlocadoId?: string | null;
  motoristaAlocadoId?: string | null;
  veiculoAlocado?: { placa: string; modelo: string } | null;
  motoristaAlocado?: { nome: string | null } | null;
}

export function normalizarSolicitacao(raw: SolicitacaoApiRaw): SolicitacaoViagem {
  return {
    id: raw.id,
    protocolo: raw.protocolo,
    solicitanteId: raw.solicitanteId,
    solicitanteNome: raw.solicitanteNome ?? "Solicitante",
    setorOrigem: raw.setorOrigem,
    origem: raw.origem,
    destino: raw.destino,
    dataHoraPretendida: raw.dataHoraPretendida,
    dataHoraRetornoPrevista: raw.dataHoraRetornoPrevista ?? undefined,
    quantidadePassageiros: Number(raw.quantidadePassageiros ?? 0),
    tipoTransporte: raw.tipoTransporte,
    urgencia: raw.urgencia,
    justificativa: raw.justificativa,
    observacoes: raw.observacoes ?? undefined,
    status: raw.status,
    criadoEm: raw.criadoEm,
    motivoRecusa: raw.motivoRecusa ?? undefined,
    veiculoAlocadoId: raw.veiculoAlocadoId ?? null,
    motoristaAlocadoId: raw.motoristaAlocadoId ?? null,
    veiculoAlocado: raw.veiculoAlocado ?? undefined,
    motoristaAlocado: raw.motoristaAlocado?.nome ? { nome: raw.motoristaAlocado.nome } : undefined,
  };
}

const CONTAGEM_VAZIA: ContagemPorStatus = {
  PENDENTE: 0,
  APROVADA: 0,
  EM_TRANSITO: 0,
  CONCLUIDA: 0,
  RECUSADA: 0,
};

export async function listarSolicitacoesApi(
  params: ListarSolicitacoesParams = {},
  token?: string | null,
): Promise<ListaSolicitacoesResposta> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status && params.status.length > 0) {
    query.set("status", params.status.join(","));
  }
  if (params.urgencia) query.set("urgencia", params.urgencia);
  if (params.tipoTransporte) query.set("tipoTransporte", params.tipoTransporte);
  if (params.setorOrigem && params.setorOrigem.trim()) {
    query.set("setorOrigem", params.setorOrigem.trim());
  }
  if (params.busca && params.busca.trim()) {
    query.set("busca", params.busca.trim());
  }

  const sufixo = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${obterApiUrl()}/api/v1/solicitacoes${sufixo}`, {
    method: "GET",
    headers: montarHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível carregar as solicitações de viagem."),
    );
  }

  const body = (await response.json()) as {
    data?: SolicitacaoApiRaw[];
    meta?: {
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
      porStatus?: Partial<ContagemPorStatus>;
    };
  };

  const data = Array.isArray(body.data) ? body.data.map(normalizarSolicitacao) : [];
  const porStatus: ContagemPorStatus = {
    ...CONTAGEM_VAZIA,
    ...(body.meta?.porStatus ?? {}),
  };

  return {
    data,
    meta: {
      page: body.meta?.page ?? params.page ?? 1,
      pageSize: body.meta?.pageSize ?? params.pageSize ?? 10,
      total: body.meta?.total ?? data.length,
      totalPages: body.meta?.totalPages ?? 1,
      porStatus,
    },
  };
}

export async function criarSolicitacaoApi(
  dados: NovaSolicitacaoViagem,
  token?: string | null,
): Promise<SolicitacaoViagem> {
  const response = await fetch(`${obterApiUrl()}/api/v1/solicitacoes`, {
    method: "POST",
    headers: montarHeaders(token),
    body: JSON.stringify(dados),
  });

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível registrar a solicitação de viagem."),
    );
  }

  const criada = (await response.json()) as SolicitacaoApiRaw;
  return normalizarSolicitacao(criada);
}

interface VeiculoApiRaw {
  id: string;
  placa: string;
  modelo: string;
  tipoFrota?: string;
  status?: string;
  capacidadeMaxima?: number;
  combustivel?: string | null;
  ativo?: boolean;
}

export async function listarVeiculosDisponiveisApi(
  token?: string | null,
): Promise<VeiculoDisponivelOption[]> {
  const response = await fetch(
    `${obterApiUrl()}/api/v1/veiculos?tipoFrota=ADMINISTRATIVA&status=DISPONIVEL&ativo=true&pageSize=100`,
    {
      method: "GET",
      headers: montarHeaders(token),
    },
  );

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível carregar os veículos disponíveis."),
    );
  }

  const body = (await response.json()) as { data?: VeiculoApiRaw[] } | VeiculoApiRaw[];
  const lista = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];

  return lista
    .filter(
      (v) =>
        v.ativo !== false &&
        (!v.tipoFrota || v.tipoFrota === "ADMINISTRATIVA") &&
        (!v.status || v.status === "DISPONIVEL"),
    )
    .map((v) => ({
      id: v.id,
      placa: v.placa,
      modelo: v.modelo,
      capacidadeMaxima: Number(v.capacidadeMaxima ?? 4),
      combustivel: v.combustivel ?? null,
    }));
}

interface MotoristaApiRaw {
  id: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh?: string | null;
  validadeCnh: string;
  status?: string | null;
  ativo?: boolean;
  usuario?: { id?: string; nome?: string; email?: string } | null;
}

function dataHojeIso(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function listarMotoristasDisponiveisApi(
  token?: string | null,
): Promise<MotoristaDisponivelOption[]> {
  const response = await fetch(`${obterApiUrl()}/motoristas`, {
    method: "GET",
    headers: montarHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível carregar os motoristas disponíveis."),
    );
  }

  const body = (await response.json()) as { data?: MotoristaApiRaw[] } | MotoristaApiRaw[];
  const lista = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];
  const hoje = dataHojeIso();

  return lista
    .filter((m) => {
      if (m.ativo === false) return false;
      const statusUpper = (m.status ?? "DISPONIVEL").toUpperCase();
      if (
        statusUpper === "INDISPONIVEL" ||
        statusUpper === "INATIVO" ||
        statusUpper === "EM_ROTA"
      ) {
        return false;
      }
      const validade = m.validadeCnh?.slice(0, 10) ?? "";
      return !validade || validade >= hoje;
    })
    .map((m) => ({
      id: m.id,
      nome: m.usuario?.nome?.trim() || `Motorista (${m.cpf})`,
      cpf: m.cpf,
      numeroCnh: m.numeroCnh,
      categoriaCnh: m.categoriaCnh?.trim() || "B",
      validadeCnh: m.validadeCnh.slice(0, 10),
    }));
}

function extrairRegistroAcao(payload: unknown): SolicitacaoApiRaw {
  if (payload && typeof payload === "object" && "dados" in payload) {
    const interno = (payload as { dados?: unknown }).dados;
    if (interno && typeof interno === "object") {
      return interno as SolicitacaoApiRaw;
    }
  }
  return payload as SolicitacaoApiRaw;
}

export async function aprovarSolicitacaoApi(
  id: string,
  dados: AprovarSolicitacaoInput,
  token?: string | null,
): Promise<SolicitacaoViagem> {
  const response = await fetch(`${obterApiUrl()}/api/v1/solicitacoes/${id}/aprovar`, {
    method: "PATCH",
    headers: montarHeaders(token),
    body: JSON.stringify(dados),
  });

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível aprovar a solicitação de viagem."),
    );
  }

  const corpo: unknown = await response.json();
  return normalizarSolicitacao(extrairRegistroAcao(corpo));
}

export async function recusarSolicitacaoApi(
  id: string,
  dados: RecusarSolicitacaoInput,
  token?: string | null,
): Promise<SolicitacaoViagem> {
  const response = await fetch(`${obterApiUrl()}/api/v1/solicitacoes/${id}/recusar`, {
    method: "PATCH",
    headers: montarHeaders(token),
    body: JSON.stringify(dados),
  });

  if (!response.ok) {
    throw new Error(
      await extrairErroApi(response, "Não foi possível recusar a solicitação de viagem."),
    );
  }

  const corpo: unknown = await response.json();
  return normalizarSolicitacao(extrairRegistroAcao(corpo));
}
