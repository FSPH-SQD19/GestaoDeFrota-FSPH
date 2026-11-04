import { prisma } from "../lib/prisma";
import { listarSolicitacoes } from "./solicitacao_s";
import { STATUS_VEICULO } from "./veiculo_s";
import type { UsuarioAutenticado } from "../middleware/http_m";
import { listarAlertasDocumentosVeiculos } from "./documento_veiculo_s";

export async function obterResumoDashboard(usuario: UsuarioAutenticado) {
  const [grupos, solicitacoes, alertas] = await Promise.all([
    prisma.veiculo.groupBy({
      by: ["status"],
      where: { ativo: true },
      _count: { _all: true },
    }),
    listarSolicitacoes({ page: 1, pageSize: 6 }, usuario),
    listarAlertasDocumentosVeiculos(),
  ]);
  const porStatus = Object.fromEntries(STATUS_VEICULO.map((status) => [status, 0]));
  let total = 0;
  for (const grupo of grupos) {
    porStatus[grupo.status] = grupo._count._all;
    total += grupo._count._all;
  }
  return { veiculos: { total, porStatus }, solicitacoes, alertas };
}
