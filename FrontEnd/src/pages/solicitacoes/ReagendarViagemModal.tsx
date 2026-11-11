import { useEffect, useRef, useState } from "react";
import { Button, Modal, Select, Textarea } from "../../components/common";
import { apiRequest } from "../../lib/api";
import { dispararAtualizacaoNotificacoes } from "../../services/notificacoesService";
import type { SolicitacaoViagem } from "../../types/solicitacao";

type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  capacidadeMaxima: number;
  ativo: boolean;
  tipoFrota: string;
  status: string;
};

type Motorista = {
  id: string;
  cpf: string;
  ativo: boolean;
  status: string;
  validadeCnh: string;
  usuario: { nome: string } | null;
};

interface Props {
  solicitacao: SolicitacaoViagem;
  sessionKey: string | null;
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}

export function ReagendarViagemModal({
  solicitacao,
  sessionKey,
  onClose,
  onConcluido,
}: Props) {
  const [revisao, setRevisao] = useState(0);
  const [recursos, setRecursos] = useState<{
    revisao: number;
    veiculos: Veiculo[];
    motoristas: Motorista[];
    erro: string;
  } | null>(null);

  // Inicializa com os dados atuais já alocados na viagem
  const [veiculoId, setVeiculoId] = useState(
  (solicitacao as unknown as Record<string, unknown>).veiculoAlocadoId as string ?? ""
);
const [motoristaId, setMotoristaId] = useState(
  (solicitacao as unknown as Record<string, unknown>).motoristaAlocadoId as string ?? ""
);
  // Datas convertidas para o formato de input datetime-local (YYYY-MM-DDTHH:mm)
  const formatarParaInputData = (dataIso?: string | null) => {
    if (!dataIso) return "";
    const d = new Date(dataIso);
    return d.toISOString().slice(0, 16);
  };

  const [novoDataInicio, setNovoDataInicio] = useState(
    formatarParaInputData(solicitacao.dataHoraPretendida)
  );
  const [novoDataFim, setNovoDataFim] = useState(
    formatarParaInputData(solicitacao.dataHoraRetornoPrevista)
  );
  const [motivo, setMotivo] = useState("");
  
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);

  const atual = recursos?.revisao === revisao ? recursos : null;

  const janelaValida = Boolean(
    novoDataInicio &&
    novoDataFim &&
    new Date(novoDataInicio) < new Date(novoDataFim),
  );

  useEffect(() => {
    let ativo = true;
    const carregarVeiculos = async () => {
      const veiculos: Veiculo[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const resposta = await apiRequest<{ data: Veiculo[]; meta: { totalPages: number } }>(
          `/veiculos?page=${page}&pageSize=100&tipoFrota=ADMINISTRATIVA&status=DISPONIVEL`,
          {},
        );
        if (!ativo) return [];
        veiculos.push(...resposta.data);
        totalPages = resposta.meta.totalPages;
        page++;
      } while (page <= totalPages);
      return veiculos.filter(
        (v) => v.ativo && v.tipoFrota === "ADMINISTRATIVA" && v.status === "DISPONIVEL",
      );
    };

    void Promise.all([carregarVeiculos(), apiRequest<Motorista[]>("/motoristas", {})])
      .then(([veiculos, motoristas]) => {
        const limite = novoDataFim
          ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
              new Date(novoDataFim),
            )
          : "";
        if (ativo)
          setRecursos({
            revisao,
            veiculos,
            motoristas: motoristas.filter(
              (m) => m.ativo && m.status === "DISPONIVEL" && m.validadeCnh.slice(0, 10) >= limite,
            ),
            erro: "",
          });
      })
      .catch((error: unknown) => {
        if (ativo)
          setRecursos({
            revisao,
            veiculos: [],
            motoristas: [],
            erro: error instanceof Error ? error.message : "Não foi possível carregar os recursos.",
          });
      });

    return () => {
      ativo = false;
    };
  }, [sessionKey, revisao, novoDataFim]);

  const fechar = () => {
    if (!salvando.current) onClose();
  };

  async function confirmar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando.current) return;
    setErro("");

    if (!janelaValida) {
      setErro("O reagendamento exige uma data/hora de saída anterior à de retorno.");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 5 || motivo.trim().length > 2000) {
      setErro("Informe o motivo da alteração (obrigatório, entre 5 e 2000 caracteres).");
      return;
    }

    const veiculo = atual?.veiculos.find((v) => v.id === veiculoId);
    if (veiculo && veiculo.capacidadeMaxima < solicitacao.quantidadePassageiros) {
      setErro("Capacidade do veículo selecionado é insuficiente para a quantidade de passageiros.");
      return;
    }

    salvando.current = true;
    setEnviando(true);

    try {
      await apiRequest(`/solicitacoes/${encodeURIComponent(solicitacao.id)}/reagendar`, {
        method: "PATCH",
        data: {
          novoDataInicio: new Date(novoDataInicio).toISOString(),
          novoDataFim: new Date(novoDataFim).toISOString(),
          veiculoId: veiculoId || undefined,
          motoristaId: motoristaId || undefined,
          motivo: motivo.trim(),
        },
      });

      dispararAtualizacaoNotificacoes();
      onConcluido(`Viagem ${solicitacao.protocolo} reagendada com sucesso.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir o reagendamento.");
    } finally {
      salvando.current = false;
      setEnviando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={fechar}
      title={`Reagendar viagem ${solicitacao.protocolo}`}
      description="Alterar horário, veículo ou motorista de viagem aprovada."
      footer={
        <>
          <Button variant="ghost" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="reagendar-viagem"
            variant="primary"
            isLoading={enviando}
            disabled={!janelaValida || !motivo.trim() || !atual || Boolean(atual.erro)}
          >
            Confirmar reagendamento
          </Button>
        </>
      }
    >
      <form id="reagendar-viagem" onSubmit={confirmar} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">
          Protocolo: <span className="font-medium text-slate-900">{solicitacao.protocolo}</span>. 
          Altere os campos necessários e informe obrigatoriamente o motivo.
        </p>

        <fieldset disabled={enviando} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova Data/Hora Início</label>
              <input
                type="datetime-local"
                value={novoDataInicio}
                onChange={(e) => setNovoDataInicio(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova Data/Hora Retorno</label>
              <input
                type="datetime-local"
                value={novoDataFim}
                onChange={(e) => setNovoDataFim(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {!atual ? (
            <p role="status">Carregando veículos e motoristas...</p>
          ) : atual.erro ? (
            <div role="alert">
              <p className="text-rose-700">{atual.erro}</p>
              <Button variant="outline" onClick={() => setRevisao((v) => v + 1)}>
                Recarregar recursos
              </Button>
            </div>
          ) : (
            <>
              <Select
                label="Veículo administrativo"
                value={veiculoId}
                onChange={(e) => setVeiculoId(e.target.value)}
                placeholder="Selecione o veículo"
                options={atual.veiculos.map((v) => ({
                  value: v.id,
                  label: `${v.placa} · ${v.modelo} · ${v.capacidadeMaxima} lugares`,
                }))}
              />
              <Select
                label="Motorista"
                value={motoristaId}
                onChange={(e) => setMotoristaId(e.target.value)}
                placeholder="Selecione o motorista"
                options={atual.motoristas.map((m) => ({
                  value: m.id,
                  label: m.usuario?.nome ?? `Motorista sem usuário vinculado (${m.cpf})`,
                }))}
              />
            </>
          )}

          <Textarea
            label="Motivo da alteração (Obrigatório)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            maxLength={2000}
            rows={3}
            placeholder="Descreva o motivo da alteração de horário, veículo ou motorista..."
          />
        </fieldset>

        {erro && (
          <p role="alert" className="text-sm text-rose-700 font-medium">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}