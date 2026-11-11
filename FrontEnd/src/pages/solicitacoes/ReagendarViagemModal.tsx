import { useRef, useState } from "react";
import { Button, Input, Modal } from "../../components/common";
import { apiRequest, respostaDeErro } from "../../lib/api";
import {
  atualizarOcupacao,
  dataHoraDoFormulario,
  dataHoraParaApi,
} from "../../services/manutencoesService";
import type { SolicitacaoViagem } from "../../types/solicitacao";

export function ReagendarViagemModal({
  solicitacao,
  onClose,
  onConcluido,
}: {
  solicitacao: SolicitacaoViagem;
  onClose: () => void;
  onConcluido: () => void;
}) {
  const [inicio, setInicio] = useState(() =>
    solicitacao.dataHoraPretendida ? dataHoraDoFormulario(solicitacao.dataHoraPretendida) : "",
  );
  const [fim, setFim] = useState(() =>
    solicitacao.dataHoraRetornoPrevista
      ? dataHoraDoFormulario(solicitacao.dataHoraRetornoPrevista)
      : "",
  );
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);
  const valido = Boolean(
    inicio && fim && inicio < fim && solicitacao.veiculoAlocadoId && solicitacao.motoristaAlocadoId,
  );

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!valido || salvando.current) return;
    salvando.current = true;
    setEnviando(true);
    setErro("");
    try {
      await apiRequest(`/solicitacoes/${solicitacao.id}/reagendar`, {
        method: "PATCH",
        data: {
          veiculoId: solicitacao.veiculoAlocadoId,
          motoristaId: solicitacao.motoristaAlocadoId,
          inicio: dataHoraParaApi(inicio),
          fim: dataHoraParaApi(fim),
        },
      });
      atualizarOcupacao();
      onConcluido();
    } catch (error) {
      setErro(respostaDeErro(error));
    } finally {
      salvando.current = false;
      setEnviando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!salvando.current) onClose();
      }}
      title={`Reagendar viagem ${solicitacao.protocolo}`}
      description="Informe a nova saída e o retorno previsto. Horário de Brasília."
    >
      <form onSubmit={salvar} className="space-y-4">
        <Input
          label="Saída prevista"
          type="datetime-local"
          required
          disabled={enviando}
          value={inicio}
          onChange={(event) => setInicio(event.target.value)}
        />
        <Input
          label="Retorno previsto"
          type="datetime-local"
          required
          disabled={enviando}
          value={fim}
          onChange={(event) => setFim(event.target.value)}
        />
        {inicio && fim && inicio >= fim && (
          <p role="alert">O retorno deve ser posterior à saída.</p>
        )}
        {erro && (
          <p role="alert" className="text-red-700">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={enviando || !valido}>
          {enviando ? "Salvando…" : "Confirmar reagendamento"}
        </Button>
      </form>
    </Modal>
  );
}
