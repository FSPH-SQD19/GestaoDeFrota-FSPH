import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Select, Textarea } from "../../components/common";
import { apiRequest, respostaDeErro } from "../../lib/api";
import {
  atualizarOcupacao,
  dataHoraDoFormulario,
  dataHoraParaApi,
} from "../../services/manutencoesService";
import type { SolicitacaoViagem } from "../../types/solicitacao";
import { dispararAtualizacaoNotificacoes } from "../../services/notificacoesService";

type Veiculo = { id: string; placa: string; modelo: string; capacidadeMaxima: number };
type Motorista = { id: string; ativo: boolean; status: string; usuario: { nome: string } | null };

export function ReagendarViagemModal({
  solicitacao,
  onClose,
  onConcluido,
  sessionKey,
}: {
  solicitacao: SolicitacaoViagem;
  onClose: () => void;
  onConcluido: () => void;
  sessionKey: string | null;
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
  const [veiculoId, setVeiculoId] = useState(solicitacao.veiculoAlocadoId ?? "");
  const [motoristaId, setMotoristaId] = useState(solicitacao.motoristaAlocadoId ?? "");
  const [motivo, setMotivo] = useState("");
  const [recursos, setRecursos] = useState<{ veiculos: Veiculo[]; motoristas: Motorista[] } | null>(
    null,
  );
  const [erroRecursos, setErroRecursos] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);
  const valido = Boolean(
    inicio &&
    fim &&
    inicio < fim &&
    veiculoId &&
    motoristaId &&
    motivo.trim().length >= 5 &&
    recursos,
  );

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const veiculos: Veiculo[] = [];
      let pagina = 1;
      let total = 1;
      do {
        const resposta = await apiRequest<{ data: Veiculo[]; meta: { totalPages: number } }>(
          `/veiculos?page=${pagina}&pageSize=100&tipoFrota=ADMINISTRATIVA&status=DISPONIVEL`,
        );
        veiculos.push(...resposta.data);
        total = resposta.meta.totalPages;
        pagina++;
      } while (pagina <= total);
      return veiculos;
    }
    void Promise.all([carregar(), apiRequest<Motorista[]>("/motoristas")])
      .then(([veiculos, motoristas]) => {
        if (ativo)
          setRecursos({
            veiculos,
            motoristas: motoristas.filter((m) => m.ativo && m.status === "DISPONIVEL"),
          });
      })
      .catch((error: unknown) => {
        if (ativo) setErroRecursos(respostaDeErro(error, "Não foi possível carregar os recursos."));
      });
    return () => {
      ativo = false;
    };
  }, [sessionKey, tentativa]);

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
          veiculoId,
          motoristaId,
          inicio: dataHoraParaApi(inicio),
          fim: dataHoraParaApi(fim),
          motivo: motivo.trim(),
        },
      });
      atualizarOcupacao();
      dispararAtualizacaoNotificacoes();
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
        {erroRecursos ? (
          <div role="alert">
            <p>{erroRecursos}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErroRecursos("");
                setTentativa((n) => n + 1);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : !recursos ? (
          <p role="status">Carregando veículos e motoristas…</p>
        ) : (
          <>
            <Select
              label="Veículo"
              value={veiculoId}
              onChange={(event) => setVeiculoId(event.target.value)}
              disabled={enviando}
              required
            >
              <option value="">Selecione</option>
              {!recursos.veiculos.some((v) => v.id === solicitacao.veiculoAlocadoId) &&
                solicitacao.veiculoAlocadoId && (
                  <option value={solicitacao.veiculoAlocadoId}>
                    Atual: {solicitacao.veiculoAlocado?.placa ?? "veículo alocado"}
                  </option>
                )}
              {recursos.veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.modelo} · {v.capacidadeMaxima} lugares
                </option>
              ))}
            </Select>
            <Select
              label="Motorista"
              value={motoristaId}
              onChange={(event) => setMotoristaId(event.target.value)}
              disabled={enviando}
              required
            >
              <option value="">Selecione</option>
              {!recursos.motoristas.some((m) => m.id === solicitacao.motoristaAlocadoId) &&
                solicitacao.motoristaAlocadoId && (
                  <option value={solicitacao.motoristaAlocadoId}>
                    Atual: {solicitacao.motoristaAlocado?.nome ?? "motorista alocado"}
                  </option>
                )}
              {recursos.motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.usuario?.nome ?? "Motorista sem usuário vinculado"}
                </option>
              ))}
            </Select>
          </>
        )}
        <Textarea
          label="Motivo da alteração"
          helperText="Informe de 5 a 2000 caracteres."
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          disabled={enviando}
          minLength={5}
          maxLength={2000}
          required
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
