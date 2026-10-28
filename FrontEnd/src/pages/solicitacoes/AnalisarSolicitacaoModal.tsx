import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Car,
  CheckCircle2,
  Siren,
  UserRound,
  XCircle,
} from "lucide-react";
import { Badge, Button, Modal, Select, Textarea } from "../../components/common";
import { cn } from "../../lib/utils";
import {
  listarMotoristasDisponiveisApi,
  listarVeiculosDisponiveisApi,
} from "../../services/solicitacoesService";
import {
  TIPO_TRANSPORTE_LABEL,
  type AprovarSolicitacaoInput,
  type MotoristaDisponivelOption,
  type RecusarSolicitacaoInput,
  type SolicitacaoViagem,
  type VeiculoDisponivelOption,
} from "../../types/solicitacao";

export type ModoAnaliseSolicitacao = "APROVAR" | "RECUSAR";

interface AnalisarSolicitacaoModalProps {
  solicitacao: SolicitacaoViagem | null;
  modoInicial?: ModoAnaliseSolicitacao;
  token?: string | null;
  onClose: () => void;
  onAprovar: (
    solicitacaoId: string,
    dados: AprovarSolicitacaoInput,
    resumo: { veiculo: VeiculoDisponivelOption; motorista: MotoristaDisponivelOption },
  ) => Promise<void>;
  onRecusar: (solicitacaoId: string, dados: RecusarSolicitacaoInput) => Promise<void>;
}

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatarDataHora(iso?: string): string {
  return iso ? dataHoraFmt.format(new Date(iso)) : "—";
}

function formatarDataIsoCurta(dataIso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!partes) return dataIso;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

export const AnalisarSolicitacaoModal: React.FC<AnalisarSolicitacaoModalProps> = ({
  solicitacao,
  modoInicial = "APROVAR",
  token,
  onClose,
  onAprovar,
  onRecusar,
}) => {
  const [modo, setModo] = useState<ModoAnaliseSolicitacao>(modoInicial);
  const [veiculos, setVeiculos] = useState<VeiculoDisponivelOption[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaDisponivelOption[]>([]);
  const [carregandoRecursos, setCarregandoRecursos] = useState<boolean>(Boolean(solicitacao));
  const [erroRecursos, setErroRecursos] = useState<string | null>(null);

  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!solicitacao) return;

    let ativa = true;
    void Promise.all([listarVeiculosDisponiveisApi(token), listarMotoristasDisponiveisApi(token)])
      .then(([listaVeiculos, listaMotoristas]) => {
        if (!ativa) return;
        setErroRecursos(null);
        setVeiculos(listaVeiculos);
        setMotoristas(listaMotoristas);
      })
      .catch((err: unknown) => {
        if (!ativa) return;
        setErroRecursos(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os veículos e motoristas disponíveis.",
        );
      })
      .finally(() => {
        if (ativa) setCarregandoRecursos(false);
      });

    return () => {
      ativa = false;
    };
  }, [solicitacao, token]);

  const veiculoSelecionado = useMemo(
    () => veiculos.find((v) => v.id === veiculoId) ?? null,
    [veiculos, veiculoId],
  );

  const motoristaSelecionado = useMemo(
    () => motoristas.find((m) => m.id === motoristaId) ?? null,
    [motoristas, motoristaId],
  );

  const capacidadeInsuficiente = Boolean(
    solicitacao &&
    veiculoSelecionado &&
    veiculoSelecionado.capacidadeMaxima < solicitacao.quantidadePassageiros,
  );

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitacao) return;

    setErroValidacao(null);

    if (modo === "APROVAR") {
      if (!veiculoSelecionado) {
        setErroValidacao("Selecione um veículo administrativo disponível.");
        return;
      }
      if (!motoristaSelecionado) {
        setErroValidacao("Selecione um motorista disponível com CNH válida.");
        return;
      }
      if (capacidadeInsuficiente) {
        setErroValidacao(
          `O veículo selecionado comporta ${veiculoSelecionado.capacidadeMaxima} ocupante(s), mas a solicitação exige ${solicitacao.quantidadePassageiros} passageiro(s).`,
        );
        return;
      }

      setEnviando(true);
      try {
        await onAprovar(
          solicitacao.id,
          {
            veiculoAlocadoId: veiculoSelecionado.id,
            motoristaAlocadoId: motoristaSelecionado.id,
          },
          {
            veiculo: veiculoSelecionado,
            motorista: motoristaSelecionado,
          },
        );
      } catch (err) {
        setErroValidacao(
          err instanceof Error ? err.message : "Não foi possível aprovar a solicitação.",
        );
      } finally {
        setEnviando(false);
      }
      return;
    }

    const motivoLimpo = motivoRecusa.trim();
    if (motivoLimpo.length < 10) {
      setErroValidacao("Informe o motivo da recusa com pelo menos 10 caracteres.");
      return;
    }
    if (motivoLimpo.length > 500) {
      setErroValidacao("O motivo da recusa deve ter no máximo 500 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      await onRecusar(solicitacao.id, { motivoRecusa: motivoLimpo });
    } catch (err) {
      setErroValidacao(
        err instanceof Error ? err.message : "Não foi possível recusar a solicitação.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen={solicitacao !== null}
      onClose={onClose}
      size="lg"
      title={solicitacao ? `Analisar Solicitação ${solicitacao.protocolo}` : ""}
      description={
        solicitacao
          ? `Solicitada por ${solicitacao.solicitanteNome} (${solicitacao.setorOrigem})`
          : ""
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          {modo === "APROVAR" ? (
            <Button
              type="submit"
              form="analisar-solicitacao-form"
              variant="primary"
              isLoading={enviando}
              disabled={carregandoRecursos}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirmar Aprovação e Alocação
            </Button>
          ) : (
            <Button
              type="submit"
              form="analisar-solicitacao-form"
              variant="danger"
              isLoading={enviando}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Confirmar Recusa
            </Button>
          )}
        </>
      }
    >
      {solicitacao && (
        <form id="analisar-solicitacao-form" onSubmit={handleConfirmar} className="space-y-5">
          {/* Resumo da solicitação */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{solicitacao.setorOrigem}</Badge>
                <Badge variant="info">{TIPO_TRANSPORTE_LABEL[solicitacao.tipoTransporte]}</Badge>
                <span className="text-xs font-semibold text-slate-600">
                  {solicitacao.quantidadePassageiros} passageiro(s)
                </span>
              </div>
              {solicitacao.urgencia === "URGENTE" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                  <Siren className="w-3.5 h-3.5" /> Prioridade Urgente
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Itinerário
                </span>
                <span className="block text-xs text-slate-600 mt-0.5">{solicitacao.origem}</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mt-0.5">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {solicitacao.destino}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Janela Prevista
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-800 mt-0.5">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                  Saída: {formatarDataHora(solicitacao.dataHoraPretendida)}
                </span>
                {solicitacao.dataHoraRetornoPrevista && (
                  <span className="block text-xs text-slate-500 mt-0.5 pl-5">
                    Retorno: {formatarDataHora(solicitacao.dataHoraRetornoPrevista)}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-1 border-t border-slate-200/70">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Justificativa do setor
              </span>
              <p className="text-xs text-slate-700 mt-0.5">{solicitacao.justificativa}</p>
              {solicitacao.observacoes && (
                <p className="text-xs text-slate-500 mt-1">
                  <strong>Obs.:</strong> {solicitacao.observacoes}
                </p>
              )}
            </div>
          </div>

          {/* Seletor de decisão (Aprovar vs Recusar) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={modo === "APROVAR"}
              onClick={() => {
                setModo("APROVAR");
                setErroValidacao(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
                modo === "APROVAR"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprovar e Alocar Frota
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === "RECUSAR"}
              onClick={() => {
                setModo("RECUSAR");
                setErroValidacao(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
                modo === "RECUSAR"
                  ? "bg-white text-rose-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <XCircle className="w-4 h-4" />
              Recusar Solicitação
            </button>
          </div>

          {erroValidacao && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{erroValidacao}</span>
            </div>
          )}

          {modo === "APROVAR" ? (
            <div className="space-y-4">
              {erroRecursos && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erroRecursos}</span>
                </div>
              )}

              <Select
                id="select-veiculo-alocado"
                label="Veículo disponível (Frota Administrativa)"
                required
                disabled={carregandoRecursos}
                placeholder={
                  carregandoRecursos
                    ? "Carregando veículos disponíveis..."
                    : veiculos.length === 0
                      ? "Nenhum veículo administrativo disponível"
                      : "Selecione o veículo para a viagem"
                }
                value={veiculoId}
                onChange={(e) => {
                  setVeiculoId(e.target.value);
                  setErroValidacao(null);
                }}
                options={veiculos.map((v) => ({
                  value: v.id,
                  label: `${v.placa} — ${v.modelo} (${v.capacidadeMaxima} ocupantes)`,
                }))}
              />

              {capacidadeInsuficiente && veiculoSelecionado && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Atenção: o veículo <strong>{veiculoSelecionado.placa}</strong> possui capacidade
                    máxima de <strong>{veiculoSelecionado.capacidadeMaxima}</strong> ocupante(s),
                    inferior aos <strong>{solicitacao.quantidadePassageiros}</strong> passageiros
                    solicitados.
                  </span>
                </div>
              )}

              <Select
                id="select-motorista-alocado"
                label="Motorista disponível (CNH regular)"
                required
                disabled={carregandoRecursos}
                placeholder={
                  carregandoRecursos
                    ? "Carregando motoristas disponíveis..."
                    : motoristas.length === 0
                      ? "Nenhum motorista disponível com CNH válida"
                      : "Selecione o motorista escalado"
                }
                value={motoristaId}
                onChange={(e) => {
                  setMotoristaId(e.target.value);
                  setErroValidacao(null);
                }}
                options={motoristas.map((m) => ({
                  value: m.id,
                  label: `${m.nome} — CNH ${m.categoriaCnh} (válida até ${formatarDataIsoCurta(m.validadeCnh)})`,
                }))}
              />

              {veiculoSelecionado && motoristaSelecionado && !capacidadeInsuficiente && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-950">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <Car className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-emerald-700">
                        Veículo selecionado
                      </span>
                      <span className="font-mono font-bold">{veiculoSelecionado.placa}</span> ·{" "}
                      {veiculoSelecionado.modelo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <UserRound className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-emerald-700">
                        Motorista escalado
                      </span>
                      <span className="font-semibold">{motoristaSelecionado.nome}</span> (CNH{" "}
                      {motoristaSelecionado.categoriaCnh})
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                id="motivo-recusa-input"
                label="Motivo da recusa"
                required
                rows={3}
                value={motivoRecusa}
                onChange={(e) => {
                  setMotivoRecusa(e.target.value);
                  setErroValidacao(null);
                }}
                placeholder="Descreva claramente o motivo da recusa (ex.: indisponibilidade de frota no horário, reagendamento necessário)..."
                helperText="O solicitante visualizará esta justificativa nos detalhes do pedido (mínimo de 10 caracteres)."
              />
            </div>
          )}
        </form>
      )}
    </Modal>
  );
};
