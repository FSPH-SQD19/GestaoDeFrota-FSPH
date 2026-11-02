import type { Notificacao } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, type UsuarioAutenticado } from "../middleware/http_m";
import { TIPOS_DOCUMENTO, dataDoBanco, dataLocal, documentosAtuais } from "./documento_veiculo_s";

export const TIPOS_NOTIFICACAO = [
  "SOLICITACAO_URGENTE",
  "VIAGEM_APROVADA",
  "VIAGEM_RECUSADA",
  "CNH_VENCENDO",
  "DOCUMENTO_VEICULO_VENCENDO",
  "SVO_DESINFECCAO_CONCLUIDA",
] as const;

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number];

export const DIAS_ALERTA_NOTIFICACAO = 30;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

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

async function registrarNotificacoesEmLote(itens: NovaNotificacaoInput[]): Promise<void> {
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

function montarAlertaCnh(
  motorista: {
    id: string;
    numeroCnh: string;
    validadeCnh: Date;
    usuario?: { nome: string } | null;
  },
  destinatarioId: string,
  hoje: string,
): NovaNotificacaoInput | null {
  const vencimentoIso = dataDoBanco(motorista.validadeCnh);
  const dias = diasEntreDatasIso(hoje, vencimentoIso);
  if (dias > DIAS_ALERTA_NOTIFICACAO) return null;

  const nome = motorista.usuario?.nome?.trim() || `CNH ${motorista.numeroCnh}`;
  const dataFmt = formatarDataPtBr(vencimentoIso);

  let titulo: string;
  let mensagem: string;
  if (dias < 0) {
    titulo = `CNH vencida — ${nome}`;
    mensagem = `A CNH (${motorista.numeroCnh}) de ${nome} venceu em ${dataFmt}.`;
  } else if (dias === 0) {
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
    chaveUnica: `cnh-30d:${motorista.id}:${vencimentoIso}:${destinatarioId}`,
  };
}

export async function sincronizarAlertasVencimento(
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
): Promise<void> {
  if (!clienteNotificacaoDisponivel()) return;

  const hoje = dataLocal(agora);
  const limiteCnh = somarDiasIso(hoje, DIAS_ALERTA_NOTIFICACAO);
  const ehGestao = usuario.perfis.some((perfil) => perfil === "ADMIN" || perfil === "GESTOR");
  const alertas: NovaNotificacaoInput[] = [];

  if (ehGestao) {
    const [motoristas, veiculos] = await Promise.all([
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
      prisma.veiculo.findMany({
        where: {
          ativo: true,
          documentos: {
            some: {
              tipoDocumento: { in: [...TIPOS_DOCUMENTO] },
            },
          },
        },
        select: {
          id: true,
          placa: true,
          modelo: true,
          documentos: {
            where: { tipoDocumento: { in: [...TIPOS_DOCUMENTO] } },
            select: {
              id: true,
              tipoDocumento: true,
              dataVencimento: true,
            },
          },
        },
      }),
    ]);

    for (const motorista of motoristas) {
      const alerta = montarAlertaCnh(motorista, usuario.id, hoje);
      if (alerta) alertas.push(alerta);
    }

    for (const veiculo of veiculos) {
      const atuais = documentosAtuais(veiculo.documentos);
      for (const [tipo, doc] of atuais.entries()) {
        const vencimentoIso = dataDoBanco(doc.dataVencimento);
        const dias = diasEntreDatasIso(hoje, vencimentoIso);
        if (dias > DIAS_ALERTA_NOTIFICACAO) continue;

        const dataFmt = formatarDataPtBr(vencimentoIso);
        let titulo: string;
        let mensagem: string;
        if (dias < 0) {
          titulo = `${tipo} vencido — ${veiculo.placa}`;
          mensagem = `O documento ${tipo} do veículo ${veiculo.placa} (${veiculo.modelo}) venceu em ${dataFmt}.`;
        } else if (dias === 0) {
          titulo = `${tipo} vence hoje — ${veiculo.placa}`;
          mensagem = `O documento ${tipo} do veículo ${veiculo.placa} (${veiculo.modelo}) vence hoje (${dataFmt}).`;
        } else {
          titulo = `${tipo} próximo do vencimento — ${veiculo.placa}`;
          mensagem = `O documento ${tipo} do veículo ${veiculo.placa} (${veiculo.modelo}) vence em ${dias} dia(s) (${dataFmt}).`;
        }

        alertas.push({
          usuarioId: usuario.id,
          tipo: "DOCUMENTO_VEICULO_VENCENDO",
          titulo,
          mensagem,
          referenciaTipo: "VEICULO",
          referenciaId: veiculo.id,
          chaveUnica: `doc-30d:${doc.id}:${vencimentoIso}:${usuario.id}`,
        });
      }
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
      if (alerta) alertas.push(alerta);
    }
  }

  await registrarNotificacoesEmLote(alertas);
}

export async function listarNotificacoes(
  usuario: UsuarioAutenticado,
  query: ListarNotificacoesQuery,
  agora: Date = new Date(),
) {
  try {
    await sincronizarAlertasVencimento(usuario, agora);
  } catch (erro) {
    console.error("Falha ao sincronizar alertas de vencimento:", erro);
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
  if (!clienteNotificacaoDisponivel()) return;

  try {
    const destinatarios = await listarIdsUsuariosAtivosPorPerfis(["ADMIN", "GESTOR"]);
    if (destinatarios.length === 0) return;

    const origemTexto = dados.setorOrigem ? ` do setor ${dados.setorOrigem}` : "";
    const destinoTexto = dados.destino ? ` para ${dados.destino}` : "";
    const titulo = `Solicitação urgente ${dados.protocolo}`;
    const mensagem = `Nova solicitação urgente${origemTexto}${destinoTexto} aguarda análise prioritária.`;

    await registrarNotificacoesEmLote(
      destinatarios.map((destinatarioId) => ({
        usuarioId: destinatarioId,
        tipo: "SOLICITACAO_URGENTE" as const,
        titulo,
        mensagem,
        referenciaTipo: "SOLICITACAO_VIAGEM",
        referenciaId: dados.id,
        chaveUnica: `urg:${dados.id}:${destinatarioId}`,
      })),
    );
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
    const destinatarios = await listarIdsUsuariosAtivosPorPerfis(["SVO", "GESTOR", "ADMIN"]);
    if (destinatarios.length === 0) return;

    const titulo = `Viatura ${dados.placa} liberada da desinfecção`;
    const mensagem = `A viatura SVO ${dados.placa} (${dados.modelo}) concluiu a desinfecção e está disponível para despacho.`;

    await registrarNotificacoesEmLote(
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
  } catch (erro) {
    console.error("Falha ao notificar liberação de viatura SVO:", dados.veiculoId, erro);
  }
}
