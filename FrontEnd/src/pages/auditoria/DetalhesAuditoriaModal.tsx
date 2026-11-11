import React, { useState } from "react";
import { ShieldCheck, Copy, Check, Calendar, User, Database, Activity } from "lucide-react";
import { Modal, Button, Badge } from "../../components/common";
import type { ItemAuditoria } from "../../types/auditoria";

interface DetalhesAuditoriaModalProps {
  log: ItemAuditoria | null;
  isOpen: boolean;
  onClose: () => void;
}

function obterAcaoBadgeVariant(
  acao: string,
): "success" | "info" | "warning" | "danger" | "neutral" {
  const normalizada = acao.toUpperCase();
  if (
    normalizada.includes("CRIAR") ||
    normalizada.includes("CREATE") ||
    normalizada.includes("CRIACAO")
  ) {
    return "success";
  }
  if (
    normalizada.includes("ATUALIZAR") ||
    normalizada.includes("UPDATE") ||
    normalizada.includes("EDICAO")
  ) {
    return "info";
  }
  if (
    normalizada.includes("EXCLUIR") ||
    normalizada.includes("DELETE") ||
    normalizada.includes("CANCELAR")
  ) {
    return "danger";
  }
  if (
    normalizada.includes("LOGIN") ||
    normalizada.includes("LOGOUT") ||
    normalizada.includes("AUTH")
  ) {
    return "warning";
  }
  return "neutral";
}

function formatarDataHora(dataIso: string): string {
  try {
    const data = new Date(dataIso);
    if (isNaN(data.getTime())) return dataIso;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(data);
  } catch {
    return dataIso;
  }
}

export const DetalhesAuditoriaModal: React.FC<DetalhesAuditoriaModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  const [copiado, setCopiado] = useState(false);

  if (!log) return null;

  const payloadString = log.dadosNovos ? JSON.stringify(log.dadosNovos, null, 2) : null;

  const copiarPayload = async () => {
    if (!payloadString) return;
    try {
      await navigator.clipboard.writeText(payloadString);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Falha ao copiar na área de transferência
    }
  };

  const footer = (
    <Button variant="outline" onClick={onClose}>
      Fechar
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes do Log de Auditoria"
      description="Inspeção detalhada de rastreabilidade, ação operacional e payload sanitizado (LGPD)."
      size="lg"
      footer={footer}
    >
      <div className="space-y-5 text-sm">
        {/* Cabeçalho do registro */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Ação:</span>
            <Badge variant={obterAcaoBadgeVariant(log.acao)} dot>
              {log.acao}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatarDataHora(log.criadoEm)}</span>
          </div>
        </div>

        {/* Informações da Entidade e Usuário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <Database className="w-3.5 h-3.5" />
              Alvo Operacional
            </div>
            <div>
              <p className="text-xs text-slate-500">Módulo / Tabela Afetada</p>
              <p className="font-medium text-slate-800">{log.tabelaAfetada}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ID do Registro</p>
              <p className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
                {log.registroId ?? "Nenhum / Global"}
              </p>
            </div>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <User className="w-3.5 h-3.5" />
              Responsável
            </div>
            {log.usuario ? (
              <>
                <div>
                  <p className="text-xs text-slate-500">Nome e E-mail</p>
                  <p className="font-medium text-slate-800">
                    {log.usuario.nome}{" "}
                    {log.usuario.email && (
                      <span className="text-xs text-slate-500">({log.usuario.email})</span>
                    )}
                  </p>
                </div>
                {log.usuario.setor && (
                  <div>
                    <p className="text-xs text-slate-500">Setor</p>
                    <Badge variant="info" size="sm">
                      {log.usuario.setor}
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <div>
                <p className="text-xs text-slate-500">Identificação</p>
                <p className="font-medium text-slate-600 italic">
                  {log.usuarioId ? `ID: ${log.usuarioId}` : "Operação de Sistema / Automática"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payload / Alterações */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Dados Registrados (LGPD Sanitizado)</span>
            </div>
            {payloadString && (
              <button
                type="button"
                onClick={copiarPayload}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Copiar JSON"
              >
                {copiado ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar JSON</span>
                  </>
                )}
              </button>
            )}
          </div>

          {payloadString ? (
            <div className="relative">
              <pre
                data-testid="payload-json"
                className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60 border border-slate-800"
              >
                <code>{payloadString}</code>
              </pre>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
              Nenhum dado payload adicional registrado nesta operação.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
