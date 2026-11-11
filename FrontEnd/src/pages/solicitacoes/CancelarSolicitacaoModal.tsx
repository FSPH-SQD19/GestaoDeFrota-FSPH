import React, { useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { Button, Modal, Textarea } from "../../components/common";
import { cancelarSolicitacaoApi } from "../../services/solicitacoesService";
import type { SolicitacaoViagem } from "../../types/solicitacao";

interface CancelarSolicitacaoModalProps {
  solicitacao: SolicitacaoViagem | null;
  isOpen: boolean;
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}

export const CancelarSolicitacaoModal: React.FC<CancelarSolicitacaoModalProps> = ({
  solicitacao,
  isOpen,
  onClose,
  onConcluido,
}) => {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const resetar = () => {
    setMotivo("");
    setErro(null);
    setSalvando(false);
  };

  const handleClose = () => {
    if (salvando) return;
    resetar();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitacao) return;

    const motivoTrim = motivo.trim();
    if (motivoTrim.length < 3) {
      setErro("Informe uma justificativa com no mínimo 3 caracteres.");
      return;
    }
    if (motivoTrim.length > 500) {
      setErro("A justificativa deve ter no máximo 500 caracteres.");
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const res = await cancelarSolicitacaoApi(solicitacao.id, motivoTrim);
      resetar();
      onConcluido(res.mensagem || `Solicitação ${solicitacao.protocolo} cancelada com sucesso.`);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setSalvando(false);
    }
  };

  if (!solicitacao) return null;

  const temAlocacao = Boolean(solicitacao.veiculoAlocado || solicitacao.motoristaAlocado);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      title={`Cancelar Solicitação ${solicitacao.protocolo}`}
      description="Confirme o cancelamento do pedido de viagem oficial."
      footer={
        <>
          <Button type="button" variant="outline" disabled={salvando} onClick={handleClose}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="cancelar-solicitacao-form"
            variant="danger"
            isLoading={salvando}
            leftIcon={<Ban className="w-4 h-4" />}
          >
            Confirmar Cancelamento
          </Button>
        </>
      }
    >
      <form id="cancelar-solicitacao-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2.5 text-amber-800 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Atenção: esta ação é irreversível.</p>
            <p>
              {temAlocacao
                ? "Os recursos alocados (veículo e motorista) serão imediatamente liberados no sistema."
                : "A solicitação de viagem será cancelada e não entrará na programação de saídas."}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
          <p className="text-slate-500 font-semibold uppercase tracking-wider">Dados da Viagem</p>
          <p className="font-semibold text-slate-800">
            {solicitacao.origem} → {solicitacao.destino}
          </p>
          <p className="text-slate-600">
            Solicitante:{" "}
            <span className="font-medium text-slate-900">{solicitacao.solicitanteNome}</span>
            {solicitacao.setorOrigem ? ` (${solicitacao.setorOrigem})` : ""}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="motivo-cancelamento"
            className="block text-xs font-semibold text-slate-700"
          >
            Motivo do Cancelamento <span className="text-rose-600">*</span>
          </label>
          <Textarea
            id="motivo-cancelamento"
            placeholder="Descreva o motivo do cancelamento (mínimo de 3 caracteres)..."
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (erro) setErro(null);
            }}
            rows={3}
            maxLength={500}
            required
            aria-invalid={Boolean(erro)}
          />
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span>
              {erro ? (
                <span className="text-rose-600 font-medium">{erro}</span>
              ) : (
                "Obrigatório para registro na trilha de auditoria."
              )}
            </span>
            <span>{motivo.length}/500</span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
