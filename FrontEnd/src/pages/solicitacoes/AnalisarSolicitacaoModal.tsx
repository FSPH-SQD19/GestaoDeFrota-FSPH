import { useEffect, useRef, useState } from "react";
import { Button, Modal, Select, Textarea } from "../../components/common";
import { apiRequest } from "../../lib/api";
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
  token: string | null;
  modo: "APROVAR" | "RECUSAR";
  onClose: () => void;
  onConcluido: (mensagem: string) => void;
}
export function AnalisarSolicitacaoModal({
  solicitacao,
  token,
  modo,
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
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);
  const atual = recursos?.revisao === revisao ? recursos : null;
  const janelaValida = Boolean(
    solicitacao.dataHoraPretendida &&
    solicitacao.dataHoraRetornoPrevista &&
    new Date(solicitacao.dataHoraPretendida) < new Date(solicitacao.dataHoraRetornoPrevista),
  );
  useEffect(() => {
    if (modo !== "APROVAR") return;
    let ativo = true;
    const carregarVeiculos = async () => {
      const veiculos: Veiculo[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const resposta = await apiRequest<{ data: Veiculo[]; meta: { totalPages: number } }>(
          `/veiculos?page=${page}&pageSize=100&tipoFrota=ADMINISTRATIVA&status=DISPONIVEL`,
          { token },
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
    void Promise.all([carregarVeiculos(), apiRequest<Motorista[]>("/motoristas", { token })])
      .then(([veiculos, motoristas]) => {
        const fim = solicitacao.dataHoraRetornoPrevista;
        const limite = fim
          ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
              new Date(fim),
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
  }, [modo, token, revisao, solicitacao.dataHoraRetornoPrevista]);
  const fechar = () => {
    if (!salvando.current) onClose();
  };
  async function confirmar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando.current) return;
    setErro("");
    if (modo === "APROVAR") {
      const veiculo = atual?.veiculos.find((v) => v.id === veiculoId);
      if (!janelaValida) {
        setErro("A aprovação exige saída e retorno previstos válidos.");
        return;
      }
      if (!veiculo || !atual?.motoristas.some((m) => m.id === motoristaId)) {
        setErro("Selecione um veículo e um motorista disponíveis.");
        return;
      }
      if (veiculo.capacidadeMaxima < solicitacao.quantidadePassageiros) {
        setErro("Capacidade do veículo insuficiente para os passageiros.");
        return;
      }
    } else if (!motivo.trim() || motivo.trim().length > 2000) {
      setErro("Informe o motivo da recusa com até 2000 caracteres.");
      return;
    }
    salvando.current = true;
    setEnviando(true);
    try {
      await apiRequest(
        `/solicitacoes/${encodeURIComponent(solicitacao.id)}/${modo === "APROVAR" ? "aprovar" : "recusar"}`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify(
            modo === "APROVAR" ? { veiculoId, motoristaId } : { motivoRecusa: motivo.trim() },
          ),
        },
      );
      onConcluido(
        `Solicitação ${solicitacao.protocolo} ${modo === "APROVAR" ? "aprovada e alocada" : "recusada"}.`,
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir a decisão.");
    } finally {
      salvando.current = false;
      setEnviando(false);
    }
  }
  return (
    <Modal
      isOpen
      onClose={fechar}
      title={`${modo === "APROVAR" ? "Aprovar" : "Recusar"} solicitação ${solicitacao.protocolo}`}
      description={`${solicitacao.origem ?? "Origem não informada"} → ${solicitacao.destino ?? "Destino não informado"}`}
      footer={
        <>
          <Button variant="ghost" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="decisao-solicitacao"
            variant={modo === "APROVAR" ? "primary" : "danger"}
            isLoading={enviando}
            disabled={modo === "APROVAR" && (!janelaValida || !atual || Boolean(atual.erro))}
          >
            {modo === "APROVAR" ? "Confirmar aprovação" : "Confirmar recusa"}
          </Button>
        </>
      }
    >
      <form id="decisao-solicitacao" onSubmit={confirmar} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">
          {solicitacao.quantidadePassageiros} passageiro(s). A disponibilidade no período será
          confirmada ao salvar.
        </p>
        <fieldset disabled={enviando} className="space-y-4">
          {modo === "APROVAR" ? (
            <>
              {!janelaValida && (
                <p role="alert" className="text-sm text-rose-700">
                  A aprovação exige saída e retorno previstos válidos. Esta solicitação não possui
                  um intervalo válido.
                </p>
              )}
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
                  {(!atual.veiculos.length || !atual.motoristas.length) && (
                    <p className="text-sm text-amber-800">
                      Não há veículo ou motorista disponível com CNH válida até o retorno previsto.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <Textarea
              label="Motivo da recusa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              maxLength={2000}
              rows={4}
            />
          )}
        </fieldset>
        {erro && (
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}
