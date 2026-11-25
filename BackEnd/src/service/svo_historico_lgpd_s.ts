export type RegistroHistoricoSvoEntrada = {
  id: string;
  etapa: string;
  mensagemPublica: string;
  parecerInterno?: string | null;
  visivelSolicitante: boolean;
  criadoEm: Date | string;
};

export type ItemHistoricoPublicoSeguro = {
  id: string;
  etapa: string;
  mensagem: string;
  registradoEm: string;
};

export type ChamadoSvoParaVisualizacao = {
  id: string;
  numeroProtocolo: string | null;
  solicitanteId?: string | null;
  statusTriagem: string;
  statusOperacao?: string | null;
  criadoEm?: Date | string | null;
  nomeFalecido?: string | null;
  enderecoOcorrencia?: string | null;
  relatoOcorrencia?: string | null;
  justificativaTriagem?: string | null;
  historico?: RegistroHistoricoSvoEntrada[];
};

const PADROES_DADOS_SENSIVEIS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g,
];

export function ehSolicitanteExternoSomente(perfis: readonly string[]): boolean {
  const temPerfilExterno = perfis.includes("SOLICITANTE_EXTERNO") || perfis.includes("EXTERNO");
  const temPerfilOperacao =
    perfis.includes("ADMIN") || perfis.includes("SVO") || perfis.includes("GESTOR");
  return temPerfilExterno && !temPerfilOperacao;
}

export function sanitizarMensagemPublicaSvo(
  mensagem: string,
  dadosSensiveisExcluir: Array<string | null | undefined> = [],
): string {
  let limpa = mensagem.trim();

  for (const dado of dadosSensiveisExcluir) {
    if (!dado) continue;
    const trecho = dado.trim();
    if (trecho.length >= 2) {
      limpa = limpa.split(trecho).join("[dado protegido - LGPD]");
    }
  }

  for (const padrao of PADROES_DADOS_SENSIVEIS) {
    limpa = limpa.replace(padrao, "[dado protegido - LGPD]");
  }

  return limpa.slice(0, 300);
}

export function montarMensagemPublicaTriagem(decisao: "APROVAR" | "RECUSAR"): string {
  return decisao === "APROVAR"
    ? "Solicitação aprovada na triagem. Aguardando emissão da ordem de coleta."
    : "Solicitação recusada na triagem.";
}

export function montarMensagemPublicaComplementacao(protocolo: string | null): string {
  const ref = protocolo ? ` ${protocolo}` : "";
  return `Complementação registrada na solicitação${ref}.`;
}

export function montarMensagemPublicaEtapaOrdem(statusOrdem: string): string {
  switch (statusOrdem) {
    case "EM_DESLOCAMENTO":
      return "Equipe em deslocamento para atendimento.";
    case "NO_LOCAL":
      return "Equipe no local da ocorrência.";
    case "ENTREGUE_SVO":
      return "Atendimento concluído e encaminhado ao SVO.";
    case "CANCELADA":
      return "Ordem de coleta cancelada.";
    default:
      return `Etapa da operação atualizada para ${statusOrdem}.`;
  }
}

export function filtrarHistoricoPublicoSeguro(
  historico: readonly RegistroHistoricoSvoEntrada[] = [],
  dadosSensiveisExcluir: Array<string | null | undefined> = [],
): ItemHistoricoPublicoSeguro[] {
  return historico
    .filter((item) => item.visivelSolicitante)
    .map((item) => ({
      id: item.id,
      etapa: item.etapa,
      mensagem: sanitizarMensagemPublicaSvo(item.mensagemPublica, dadosSensiveisExcluir),
      registradoEm:
        item.criadoEm instanceof Date ? item.criadoEm.toISOString() : String(item.criadoEm),
    }));
}

export function serializarChamadoParaSolicitanteExterno(
  chamado: ChamadoSvoParaVisualizacao,
  usuarioId: string,
) {
  if (!chamado.solicitanteId || chamado.solicitanteId !== usuarioId) {
    return null;
  }

  const dadosSensiveis = [
    chamado.nomeFalecido,
    chamado.enderecoOcorrencia,
    chamado.relatoOcorrencia,
    chamado.justificativaTriagem,
  ];

  return {
    id: chamado.id,
    numeroProtocolo: chamado.numeroProtocolo,
    statusTriagem: chamado.statusTriagem,
    statusOperacao: chamado.statusOperacao ?? null,
    criadoEm:
      chamado.criadoEm instanceof Date
        ? chamado.criadoEm.toISOString()
        : (chamado.criadoEm ?? null),
    historicoPublico: filtrarHistoricoPublicoSeguro(chamado.historico ?? [], dadosSensiveis),
  };
}
