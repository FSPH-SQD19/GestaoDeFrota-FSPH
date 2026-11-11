import { prisma } from "../lib/prisma";
import { listarSolicitacoes } from "./solicitacao_s";
import { STATUS_VEICULO, TIPOS_FROTA } from "./veiculo_s";
import type { UsuarioAutenticado } from "../middleware/http_m";
import {
  calcularSituacao,
  dataDoBanco,
  dataLocal,
  listarAlertasDocumentosVeiculos,
} from "./documento_veiculo_s";
import { DIAS_ALERTA_NOTIFICACAO } from "./notificacao_s";
import { obterSlaRespostaSvo, STATUS_ORDEM_ATIVA } from "./svo_s";

function iniciarContagemFrota() {
  return {
    total: 0,
    totalGeral: 0,
    porStatus: Object.fromEntries([...STATUS_VEICULO, "INATIVO"].map((status) => [status, 0])),
  };
}

export async function obterResumoDashboard(usuario: UsuarioAutenticado, agora = new Date()) {
  const hoje = dataLocal(agora);
  const inicio = new Date(`${hoje}T00:00:00-03:00`);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 1);
  const limiteCnh = new Date(`${hoje}T00:00:00Z`);
  limiteCnh.setUTCDate(limiteCnh.getUTCDate() + DIAS_ALERTA_NOTIFICACAO);

  const [grupos, solicitacoes, alertas, viagensDoDia, chamadosAtivos, slaSvo, motoristas] =
    await Promise.all([
      prisma.veiculo.groupBy({
        by: ["tipoFrota", "status", "ativo"],
        _count: { _all: true },
      }),
      listarSolicitacoes({ page: 1, pageSize: 6 }, usuario),
      listarAlertasDocumentosVeiculos(hoje),
      prisma.solicitacaoViagem.count({
        where: {
          dataHoraPretendida: { gte: inicio, lt: fim },
          status: { in: ["APROVADA", "EM_TRANSITO", "CONCLUIDA"] },
        },
      }),
      prisma.chamadoSvo.count({
        where: {
          OR: [
            { statusTriagem: "EM_ANALISE" },
            {
              statusTriagem: "APROVADO",
              OR: [
                { ordemColeta: { is: null } },
                { ordemColeta: { is: { status: { in: [...STATUS_ORDEM_ATIVA] } } } },
              ],
            },
          ],
        },
      }),
      obterSlaRespostaSvo(),
      prisma.motorista.findMany({
        where: { ativo: true, validadeCnh: { lte: limiteCnh } },
        select: { id: true, validadeCnh: true, usuario: { select: { nome: true } } },
        orderBy: [{ validadeCnh: "asc" }, { id: "asc" }],
      }),
    ]);
  const frota = iniciarContagemFrota();
  const porTipoFrota = Object.fromEntries(
    TIPOS_FROTA.map((tipo) => [tipo, iniciarContagemFrota()]),
  );
  for (const grupo of grupos) {
    const status = grupo.ativo ? grupo.status : "INATIVO";
    const quantidade = grupo._count._all;
    for (const contagem of [frota, porTipoFrota[grupo.tipoFrota]]) {
      contagem.porStatus[status] = (contagem.porStatus[status] ?? 0) + quantidade;
      contagem.totalGeral += quantidade;
      if (grupo.ativo) contagem.total += quantidade;
    }
  }

  const cnh = motoristas.map(({ id, usuario: condutor, validadeCnh }) => {
    const dataVencimento = dataDoBanco(validadeCnh);
    return {
      motoristaId: id,
      nome: condutor?.nome ?? "Motorista sem usuário vinculado",
      dataVencimento,
      situacao: calcularSituacao(dataVencimento, hoje),
    };
  });
  const documentos = alertas.filter(
    ({ diasParaVencer }) => diasParaVencer <= DIAS_ALERTA_NOTIFICACAO,
  );
  return {
    veiculos: { ...frota, porTipoFrota },
    solicitacoes,
    solicitacoesPendentes: solicitacoes.meta.porStatus.PENDENTE,
    viagensDoDia,
    svo: {
      chamadosAtivos,
      slaMedioRespostaMinutos: slaSvo.tempoMedioChamadoChegadaLocalMinutos,
      slaMedioEntregaMinutos: slaSvo.tempoMedioChamadoEntregaSvoMinutos,
    },
    alertas,
    alertasOperacionais: { total: cnh.length + documentos.length, cnh, documentos },
  };
}
