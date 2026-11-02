import type { Notificacao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, type UsuarioAutenticado } from "../middleware/http_m";
import { TIPOS_DOCUMENTO, dataDoBanco, dataLocal } from "./documento_veiculo_s";
import {
  type DocumentoAtualSincronizacao,
  type MotoristaSincronizacao,
  type SolicitacaoUrgenteSincronizacao,
  invalidarCacheSincronizacaoNotificacoes,
  obterSnapshotSincronizacaoFrota,
  obterUltimaSincronizacaoNotificacoes,
  registrarSincronizacaoNotificacoes,
  registrarSnapshotSincronizacaoFrota,
} from "./notificacao_sync_cache";

export { invalidarCacheSincronizacaoNotificacoes };

export const TIPOS_NOTIFICACAO = [
  "SOLICITACAO_URGENTE",
  "VIAGEM_APROVADA",
  "VIAGEM_RECUSADA",
  "CNH_VENCENDO",
  "DOCUMENTO_VEICULO_VENCENDO",
  "SVO_DESINFECCAO_CONCLUIDA",
] as const;

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number];
type EstagioVencimento = "PROXIMO" | "HOJE" | "VENCIDO";

export const DIAS_ALERTA_NOTIFICACAO = 30;
export const INTERVALO_SINCRONIZACAO_NOTIFICACOES_MS = 5 * 60 * 1000;

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const MAX_TENTATIVAS_PERSISTENCIA = 3;
const ATRASO_RETRY_MS = 40;

const idNotificacaoSchema = z.uuid();

const booleanoQuerySchema = z.preprocess(
  (valor) => {
    if (valor === undefined || valor === "") return false;
    if (typeof valor === "boolean") return valor;
    if (valor === "true") return true;
    if (valor === "false") return false;
    return valor;
  },
  z.boolean({ error: "Parâmetro apenasNaoLidas deve ser true ou false." }),
);

export const listarNotificacoesQuerySchema = z.object({
  apenasNaoLidas: booleanoQuerySchema.default(false),
  limit: z.coerce
    .number({ error: "Limite deve ser numérico." })
    .int("Limite deve ser inteiro.")
    .min(1, "Limite mínimo é 1.")
    .max(50, "Limite máximo é 50.")
    .default(20),
});

export type ListarNotificacoesQuery = z.infer<typeof listarNotificacoesQuerySchema>;

export type NotificacaoResposta = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenciaTipo: string | null;
  referenciaId: string | null;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string;
};

type NovaNotificacaoInput = {
  usuarioId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  chaveUnica?: string | null;
};

function clienteNotificacaoDisponivel(): boolean {
  const candidato = prisma as unknown as {
    notificacao?: { createMany?: unknown };
  };
  return typeof candidato?.notificacao?.createMany === "function";
}

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max - 3).trimEnd()}...`;
}

function diasEntreDatasIso(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / UM_DIA_MS);
}

function somarDiasIso(iso: string, dias: number): Date {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * UM_DIA_MS);
}

function formatarDataPtBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterEstagioVencimento(dias: number): EstagioVencimento {
  if (dias < 0) return "VENCIDO";
  if (dias === 0) return "HOJE";
  return "PROXIMO";
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarComRetentativa<T>(operacao: () => Promise<T>): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_PERSISTENCIA; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < MAX_TENTATIVAS_PERSISTENCIA) {
        await aguardar(ATRASO_RETRY_MS * tentativa);
      }
    }
  }
  throw ultimoErro;
}

export function serializarNotificacao(registro: Notificacao): NotificacaoResposta {
  return {
    id: registro.id,
    tipo: registro.tipo,
    titulo: registro.titulo,
    mensagem: registro.mensagem,
    referenciaTipo: registro.referenciaTipo,
    referenciaId: registro.referenciaId,
    lida: registro.lida,
    lidaEm: registro.lidaEm ? registro.lidaEm.toISOString() : null,
    criadoEm: registro.criadoEm.toISOString(),
  };
}

async function listarIdsUsuariosAtivosPorPerfis(perfis: readonly string[]): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfis: {
        some: {
          perfil: {
            nome: { in: [...perfis] },
          },
        },
      },
    },
    select: { id: true },
  });
  return usuarios.map((u) => u.id);
}

async function criarNotificacoesEmLote(itens: NovaNotificacaoInput[]): Promise<void> {
  if (itens.length === 0 || !clienteNotificacaoDisponivel()) return;

  await prisma.notificacao.createMany({
    data: itens.map((item) => ({
      usuarioId: item.usuarioId,
      tipo: item.tipo,
      titulo: truncar(item.titulo, 150),
      mensagem: truncar(item.mensagem, 500),
      referenciaTipo: item.referenciaTipo ?? null,
      referenciaId: item.referenciaId ?? null,
      chaveUnica: item.chaveUnica ?? null,
    })),
    skipDuplicates: true,
  });
}

async function registrarNotificacoesEmLote(itens: NovaNotificacaoInput[]): Promise<void> {
  if (itens.length === 0 || !clienteNotificacaoDisponivel()) return;
  await executarComRetentativa(() => criarNotificacoesEmLote(itens));
}

function montarAlertaUrgenteParaDestinatario(
  dados: {
    id: string;
    protocolo: string;
    setorOrigem?: string | null;
    destino?: string | null;
  },
  destinatarioId: string,
): NovaNotificacaoInput {
  const origemTexto = dados.setorOrigem ? ` do setor ${dados.setorOrigem}` : "";
  const destinoTexto = dados.destino ? ` para ${dados.destino}` : "";
  return {
    usuarioId: destinatarioId,
    tipo: "SOLICITACAO_URGENTE",
    titulo: `Solicitação urgente ${dados.protocolo}`,
    mensagem: `Nova solicitação urgente${origemTexto}${destinoTexto} aguarda análise prioritária.`,
    referenciaTipo: "SOLICITACAO_VIAGEM",
    referenciaId: dados.id,
    chaveUnica: `urg:${dados.id}:${destinatarioId}`,
  };
}

function montarAlertaCnh(
  motorista: MotoristaSincronizacao,
  destinatarioId: string,
  hoje: string,
): NovaNotificacaoInput | null {
  const vencimentoIso = dataDoBanco(motorista.validadeCnh);
  const dias = diasEntreDatasIso(hoje, vencimentoIso);
  if (dias > DIAS_ALERTA_NOTIFICACAO) return null;

  const estagio = obterEstagioVencimento(dias);
  const nome = motorista.usuario?.nome?.trim() || `CNH ${motorista.numeroCnh}`;
  const dataFmt = formatarDataPtBr(vencimentoIso);

  let titulo: string;
  let mensagem: string;
  if (estagio === "VENCIDO") {
    titulo = `CNH vencida — ${nome}`;
    mensagem = `A CNH (${motorista.numeroCnh}) de ${nome} venceu em ${dataFmt}.`;
  } else if (estagio === "HOJE") {
    titulo = `CNH vence hoje — ${nome}`;
    mensagem = `A CNH (${motorista.numeroCnh}) de ${nome} vence hoje (${dataFmt}).`;
  } else {
    titulo = `CNH próxima do vencimento — ${nome}`;
    mensagem = `A CNH (${motorista.numeroCnh}) de ${nome} vence em ${dias} dia(s) (${dataFmt}).`;
  }

  return {
    usuarioId: destinatarioId,
    tipo: "CNH_VENCENDO",
    titulo,
    mensagem,
    referenciaTipo: "MOTORISTA",
    referenciaId: motorista.id,
    chaveUnica: `cnh-30d:${motorista.id}:${vencimentoIso}:${estagio}:${destinatarioId}`,
  };
}

async function buscarDocumentosAtuaisVeiculosAtivos(): Promise<DocumentoAtualSincronizacao[]> {
  const candidato = prisma as unknown as {
    documentoVeiculo?: { findMany?: unknown };
  };
  if (typeof candidato.documentoVeiculo?.findMany !== "function") {
    return [];
  }

  const registros = await prisma.documentoVeiculo.findMany({
    where: {
      tipoDocumento: { in: [...TIPOS_DOCUMENTO] },
      veiculo: { ativo: true },
    },
    distinct: ["veiculoId", "tipoDocumento"],
    orderBy: [{ veiculoId: "asc" }, { tipoDocumento: "asc" }, { dataVencimento: "desc" }],
    select: {
      id: true,
      veiculoId: true,
      tipoDocumento: true,
      dataVencimento: true,
      veiculo: {
        select: {
          placa: true,
          modelo: true,
        },
      },
    },
  });

  const porVeiculoETipo = new Map<string, DocumentoAtualSincronizacao>();
  for (const doc of registros) {
    if (typeof doc.tipoDocumento !== "string") continue;
    const chave = `${doc.veiculoId}:${doc.tipoDocumento}`;
    const existente = porVeiculoETipo.get(chave);
    if (!existente || doc.dataVencimento > existente.dataVencimento) {
      porVeiculoETipo.set(chave, {
        id: doc.id,
        veiculoId: doc.veiculoId,
        tipoDocumento: doc.tipoDocumento,
        dataVencimento: doc.dataVencimento,
        veiculo: doc.veiculo,
      });
    }
  }

  return [...porVeiculoETipo.values()];
}

async function buscarSolicitacoesUrgentesPendentes(): Promise<SolicitacaoUrgenteSincronizacao[]> {
  const candidato = prisma as unknown as {
    solicitacaoViagem?: { findMany?: unknown };
  };
  if (typeof candidato.solicitacaoViagem?.findMany !== "function") {
    return [];
  }

  return prisma.solicitacaoViagem.findMany({
    where: {
      status: "PENDENTE",
      urgencia: "URGENTE",
    },
    select: {
      id: true,
      protocolo: true,
      setorOrigem: true,
      destino: true,
    },
  });
}

async function obterDadosSincronizacaoGestao(
  hoje: string,
  limiteCnh: Date,
  agoraMs: number,
  usarCacheFrota: boolean,
): Promise<{
  motoristas: MotoristaSincronizacao[];
  documentosAtuaisVeiculos: DocumentoAtualSincronizacao[];
  solicitacoesUrgentes: SolicitacaoUrgenteSincronizacao[];
}> {
  if (usarCacheFrota) {
    const cache = obterSnapshotSincronizacaoFrota();
    if (
      cache &&
      cache.dia === hoje &&
      agoraMs - cache.timestampMs < INTERVALO_SINCRONIZACAO_NOTIFICACOES_MS
    ) {
      return {
        motoristas: cache.motoristas,
        documentosAtuaisVeiculos: cache.documentosAtuaisVeiculos,
        solicitacoesUrgentes: cache.solicitacoesUrgentes,
      };
    }
  }

  const [motoristas, documentosAtuaisVeiculos, solicitacoesUrgentes] = await Promise.all([
    prisma.motorista.findMany({
      where: {
        ativo: true,
        validadeCnh: { lte: limiteCnh },
      },
      select: {
        id: true,
        numeroCnh: true,
        validadeCnh: true,
        usuario: { select: { nome: true } },
      },
    }),
    buscarDocumentosAtuaisVeiculosAtivos(),
    buscarSolicitacoesUrgentesPendentes(),
  ]);

  if (usarCacheFrota) {
    registrarSnapshotSincronizacaoFrota({
      dia: hoje,
      timestampMs: agoraMs,
      motoristas,
      documentosAtuaisVeiculos,
      solicitacoesUrgentes,
    });
  }

  return { motoristas, documentosAtuaisVeiculos, solicitacoesUrgentes };
}

async function reconciliarAlertasVencimentoUsuario(
  usuarioId: string,
  alertasVencimento: NovaNotificacaoInput[],
  agora: Date,
): Promise<void> {
  const candidato = prisma as unknown as {
    notificacao?: {
      findMany?: unknown;
      update?: unknown;
      updateMany?: unknown;
    };
  };

  const chavesAtivas = alertasVencimento
    .map((item) => item.chaveUnica)
    .filter((chave): chave is string => Boolean(chave));

  // Atualiza texto de avisos ainda ativos no mesmo estágio (ex.: contagem regressiva de dias)
  if (
    chavesAtivas.length > 0 &&
    typeof candidato.notificacao?.findMany === "function" &&
    typeof candidato.notificacao?.update === "function"
  ) {
    const existentes = await prisma.notificacao.findMany({
      where: {
        usuarioId,
        chaveUnica: { in: chavesAtivas },
      },
      select: {
        id: true,
        chaveUnica: true,
        titulo: true,
        mensagem: true,
      },
    });

    if (Array.isArray(existentes) && existentes.length > 0) {
      const esperadoPorChave = new Map(
        alertasVencimento
          .filter((item): item is NovaNotificacaoInput & { chaveUnica: string } =>
            Boolean(item.chaveUnica),
          )
          .map((item) => [
            item.chaveUnica,
            {
              titulo: truncar(item.titulo, 150),
              mensagem: truncar(item.mensagem, 500),
            },
          ]),
      );

      await Promise.all(
        existentes
          .filter((atual) => {
            const esperado = atual.chaveUnica ? esperadoPorChave.get(atual.chaveUnica) : undefined;
            return (
              esperado !== undefined &&
              (atual.titulo !== esperado.titulo || atual.mensagem !== esperado.mensagem)
            );
          })
          .map((atual) => {
            const esperado = esperadoPorChave.get(atual.chaveUnica!)!;
            return prisma.notificacao.update({
              where: { id: atual.id },
              data: {
                titulo: esperado.titulo,
                mensagem: esperado.mensagem,
              },
            });
          }),
      );
    }
  }

  // Baixa automaticamente avisos não lidos de documentos/CNH já renovados ou substituídos por novo estágio
  if (typeof candidato.notificacao?.updateMany === "function") {
    await prisma.notificacao.updateMany({
      where: {
        usuarioId,
        tipo: { in: ["CNH_VENCENDO", "DOCUMENTO_VEICULO_VENCENDO"] },
        lida: false,
        ...(chavesAtivas.length > 0
          ? {
              OR: [{ chaveUnica: null }, { chaveUnica: { notIn: chavesAtivas } }],
            }
          : {}),
      },
      data: {
        lida: true,
        lidaEm: agora,
      },
    });
  }
}

export async function sincronizarAlertasVencimento(
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
  opcoes?: { usarCacheFrota?: boolean },
): Promise<void> {
  if (!clienteNotificacaoDisponivel()) return;

  const hoje = dataLocal(agora);
  const limiteCnh = somarDiasIso(hoje, DIAS_ALERTA_NOTIFICACAO);
  const ehGestao = usuario.perfis.some((perfil) => perfil === "ADMIN" || perfil === "GESTOR");
  const alertasVencimento: NovaNotificacaoInput[] = [];
  const alertasUrgentesPendentes: NovaNotificacaoInput[] = [];

  if (ehGestao) {
    const { motoristas, documentosAtuaisVeiculos, solicitacoesUrgentes } =
      await obterDadosSincronizacaoGestao(
        hoje,
        limiteCnh,
        agora.getTime(),
        Boolean(opcoes?.usarCacheFrota),
      );

    for (const motorista of motoristas) {
      const alerta = montarAlertaCnh(motorista, usuario.id, hoje);
      if (alerta) alertasVencimento.push(alerta);
    }

    for (const doc of documentosAtuaisVeiculos) {
      const vencimentoIso = dataDoBanco(doc.dataVencimento);
      const dias = diasEntreDatasIso(hoje, vencimentoIso);
      if (dias > DIAS_ALERTA_NOTIFICACAO) continue;

      const estagio = obterEstagioVencimento(dias);
      const dataFmt = formatarDataPtBr(vencimentoIso);
      let titulo: string;
      let mensagem: string;
      if (estagio === "VENCIDO") {
        titulo = `${doc.tipoDocumento} vencido — ${doc.veiculo.placa}`;
        mensagem = `O documento ${doc.tipoDocumento} do veículo ${doc.veiculo.placa} (${doc.veiculo.modelo}) venceu em ${dataFmt}.`;
      } else if (estagio === "HOJE") {
        titulo = `${doc.tipoDocumento} vence hoje — ${doc.veiculo.placa}`;
        mensagem = `O documento ${doc.tipoDocumento} do veículo ${doc.veiculo.placa} (${doc.veiculo.modelo}) vence hoje (${dataFmt}).`;
      } else {
        titulo = `${doc.tipoDocumento} próximo do vencimento — ${doc.veiculo.placa}`;
        mensagem = `O documento ${doc.tipoDocumento} do veículo ${doc.veiculo.placa} (${doc.veiculo.modelo}) vence em ${dias} dia(s) (${dataFmt}).`;
      }

      alertasVencimento.push({
        usuarioId: usuario.id,
        tipo: "DOCUMENTO_VEICULO_VENCENDO",
        titulo,
        mensagem,
        referenciaTipo: "VEICULO",
        referenciaId: doc.veiculoId,
        chaveUnica: `doc-30d:${doc.id}:${vencimentoIso}:${estagio}:${usuario.id}`,
      });
    }

    for (const sol of solicitacoesUrgentes) {
      alertasUrgentesPendentes.push(montarAlertaUrgenteParaDestinatario(sol, usuario.id));
    }
  } else if (usuario.perfis.includes("MOTORISTA")) {
    const motorista = await prisma.motorista.findFirst({
      where: {
        usuarioId: usuario.id,
        ativo: true,
        validadeCnh: { lte: limiteCnh },
      },
      select: {
        id: true,
        numeroCnh: true,
        validadeCnh: true,
        usuario: { select: { nome: true } },
      },
    });
    if (motorista) {
      const alerta = montarAlertaCnh(motorista, usuario.id, hoje);
      if (alerta) alertasVencimento.push(alerta);
    }
  }

  await registrarNotificacoesEmLote([...alertasVencimento, ...alertasUrgentesPendentes]);

  if (ehGestao || usuario.perfis.includes("MOTORISTA")) {
    await reconciliarAlertasVencimentoUsuario(usuario.id, alertasVencimento, agora);
  }
}

export async function listarNotificacoes(
  usuario: UsuarioAutenticado,
  query: ListarNotificacoesQuery,
  agora: Date = new Date(),
) {
  const hoje = dataLocal(agora);
  const ultimoSync = obterUltimaSincronizacaoNotificacoes(usuario.id);
  const precisaSincronizar =
    !ultimoSync ||
    ultimoSync.dia !== hoje ||
    agora.getTime() - ultimoSync.timestampMs >= INTERVALO_SINCRONIZACAO_NOTIFICACOES_MS;

  if (precisaSincronizar) {
    try {
      await sincronizarAlertasVencimento(usuario, agora, { usarCacheFrota: true });
      registrarSincronizacaoNotificacoes(usuario.id, {
        dia: hoje,
        timestampMs: agora.getTime(),
      });
    } catch (erro) {
      console.error("Falha ao sincronizar alertas de vencimento:", erro);
    }
  }

  const whereListagem = {
    usuarioId: usuario.id,
    ...(query.apenasNaoLidas ? { lida: false } : {}),
  };

  const [registros, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: whereListagem,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      take: query.limit,
    }),
    prisma.notificacao.count({
      where: { usuarioId: usuario.id, lida: false },
    }),
  ]);

  const data = registros.map(serializarNotificacao);

  return {
    data,
    meta: {
      naoLidas,
      retornadas: data.length,
    },
  };
}

export async function marcarNotificacaoComoLida(id: string, usuarioId: string) {
  if (!idNotificacaoSchema.safeParse(id).success) {
    throw new HttpError(400, "ID da notificação inválido.", [
      { campo: "id", mensagem: "Informe um UUID válido." },
    ]);
  }

  const existente = await prisma.notificacao.findFirst({
    where: { id, usuarioId },
  });

  if (!existente) {
    throw new HttpError(404, "Notificação não encontrada.");
  }

  if (existente.lida) {
    return serializarNotificacao(existente);
  }

  const atualizada = await prisma.notificacao.update({
    where: { id: existente.id },
    data: {
      lida: true,
      lidaEm: new Date(),
    },
  });

  return serializarNotificacao(atualizada);
}

export async function marcarTodasNotificacoesComoLidas(usuarioId: string) {
  const resultado = await prisma.notificacao.updateMany({
    where: {
      usuarioId,
      lida: false,
    },
    data: {
      lida: true,
      lidaEm: new Date(),
    },
  });

  return {
    atualizadas: resultado.count,
    naoLidas: 0,
  };
}

export async function notificarSolicitacaoUrgente(dados: {
  id: string;
  protocolo: string;
  setorOrigem?: string | null;
  destino?: string | null;
}): Promise<void> {
  invalidarCacheSincronizacaoNotificacoes();
  if (!clienteNotificacaoDisponivel()) return;

  try {
    await executarComRetentativa(async () => {
      const destinatarios = await listarIdsUsuariosAtivosPorPerfis(["ADMIN", "GESTOR"]);
      if (destinatarios.length === 0) return;

      await criarNotificacoesEmLote(
        destinatarios.map((destinatarioId) =>
          montarAlertaUrgenteParaDestinatario(dados, destinatarioId),
        ),
      );
    });
  } catch (erro) {
    console.error("Falha ao notificar solicitação urgente:", dados.id, erro);
  }
}

export async function notificarSolicitacaoAprovada(dados: {
  id: string;
  protocolo: string;
  destino?: string | null;
  solicitanteId: string;
  veiculoPlaca?: string | null;
  motoristaUsuarioId?: string | null;
}): Promise<void> {
  invalidarCacheSincronizacaoNotificacoes();
  if (!clienteNotificacaoDisponivel()) return;

  try {
    const veiculoTexto = dados.veiculoPlaca ? ` com o veículo ${dados.veiculoPlaca}` : "";
    const destinoTexto = dados.destino ? ` para ${dados.destino}` : "";

    const itens: NovaNotificacaoInput[] = [
      {
        usuarioId: dados.solicitanteId,
        tipo: "VIAGEM_APROVADA",
        titulo: `Viagem ${dados.protocolo} aprovada`,
        mensagem: `Sua solicitação${destinoTexto} foi aprovada${veiculoTexto}.`,
        referenciaTipo: "SOLICITACAO_VIAGEM",
        referenciaId: dados.id,
        chaveUnica: `aprov-sol:${dados.id}:${dados.solicitanteId}`,
      },
    ];

    if (dados.motoristaUsuarioId && dados.motoristaUsuarioId !== dados.solicitanteId) {
      itens.push({
        usuarioId: dados.motoristaUsuarioId,
        tipo: "VIAGEM_APROVADA",
        titulo: `Nova viagem ${dados.protocolo} alocada`,
        mensagem: `Você foi alocado para conduzir${veiculoTexto || " a viagem"}${destinoTexto}.`,
        referenciaTipo: "SOLICITACAO_VIAGEM",
        referenciaId: dados.id,
        chaveUnica: `aprov-mot:${dados.id}:${dados.motoristaUsuarioId}`,
      });
    }

    await registrarNotificacoesEmLote(itens);
  } catch (erro) {
    console.error("Falha ao notificar aprovação da solicitação:", dados.id, erro);
  }
}

export async function notificarSolicitacaoRecusada(dados: {
  id: string;
  protocolo: string;
  solicitanteId: string;
  motivoRecusa: string;
}): Promise<void> {
  invalidarCacheSincronizacaoNotificacoes();
  if (!clienteNotificacaoDisponivel()) return;

  try {
    await registrarNotificacoesEmLote([
      {
        usuarioId: dados.solicitanteId,
        tipo: "VIAGEM_RECUSADA",
        titulo: `Viagem ${dados.protocolo} recusada`,
        mensagem: `Sua solicitação ${dados.protocolo} foi recusada. Motivo: ${dados.motivoRecusa}`,
        referenciaTipo: "SOLICITACAO_VIAGEM",
        referenciaId: dados.id,
        chaveUnica: `recusa:${dados.id}:${dados.solicitanteId}`,
      },
    ]);
  } catch (erro) {
    console.error("Falha ao notificar recusa da solicitação:", dados.id, erro);
  }
}

export async function notificarViaturaSvoLiberada(dados: {
  veiculoId: string;
  placa: string;
  modelo: string;
  referenciaDesinfeccao?: string;
}): Promise<void> {
  if (!clienteNotificacaoDisponivel()) return;

  try {
    await executarComRetentativa(async () => {
      const destinatarios = await listarIdsUsuariosAtivosPorPerfis(["SVO", "GESTOR", "ADMIN"]);
      if (destinatarios.length === 0) return;

      const titulo = `Viatura ${dados.placa} liberada da desinfecção`;
      const mensagem = `A viatura SVO ${dados.placa} (${dados.modelo}) concluiu a desinfecção e está disponível para despacho.`;

      await criarNotificacoesEmLote(
        destinatarios.map((destinatarioId) => ({
          usuarioId: destinatarioId,
          tipo: "SVO_DESINFECCAO_CONCLUIDA" as const,
          titulo,
          mensagem,
          referenciaTipo: "VEICULO",
          referenciaId: dados.veiculoId,
          chaveUnica: dados.referenciaDesinfeccao
            ? `svo-lib:${dados.veiculoId}:${dados.referenciaDesinfeccao}:${destinatarioId}`
            : null,
        })),
      );
    });
  } catch (erro) {
    console.error("Falha ao notificar liberação de viatura SVO:", dados.veiculoId, erro);
  }
}
