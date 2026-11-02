import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Ambulance,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Textarea } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { cn } from "../../lib/utils";
import {
  concluirColetaSvo,
  concluirDesinfeccaoSvo,
  criarChamadoSvo,
  criarOrdemColetaSvo,
  extrairErroSvo,
  obterChamadosSvo,
  obterIndicadoresSvo,
  obterMotoristasSvo,
  obterViaturasSvo,
  triarChamadoSvo,
  type ChamadoSvo,
  type EtapaFiltroSvo,
  type IndicadoresSvo,
  type MotoristaSvo,
  type ViaturaSvo,
} from "../../services/svo";

type ModalSvo = "REGISTRO" | "TRIAGEM" | "ORDEM" | "DETALHE" | null;
type StatusOperacionalChamado =
  "EM_ANALISE" | "AGUARDANDO_ORDEM" | "EM_OPERACAO" | "CONCLUIDO" | "RECUSADO";

const PAGE_SIZE = 10;

const INDICADORES_VAZIOS: IndicadoresSvo = {
  total: 0,
  emAnalise: 0,
  aguardandoOrdem: 0,
  aprovados: 0,
  recusados: 0,
  coletasEmAndamento: 0,
  viaturasDisponiveis: 0,
  totalViaturas: 0,
};

const FILTROS: { id: EtapaFiltroSvo; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "EM_ANALISE", label: "Aguardando triagem" },
  { id: "AGUARDANDO_ORDEM", label: "Aguardando ordem" },
  { id: "EM_OPERACAO", label: "Em operação" },
  { id: "ENCERRADO", label: "Encerrados" },
];

const STATUS_CHAMADO_LABEL: Record<StatusOperacionalChamado, string> = {
  EM_ANALISE: "Aguardando triagem",
  AGUARDANDO_ORDEM: "Triagem aprovada",
  EM_OPERACAO: "Em coleta",
  CONCLUIDO: "Coleta concluída",
  RECUSADO: "Recusado na triagem",
};

const STATUS_CHAMADO_VARIANT: Record<
  StatusOperacionalChamado,
  "warning" | "info" | "success" | "neutral" | "danger"
> = {
  EM_ANALISE: "warning",
  AGUARDANDO_ORDEM: "info",
  EM_OPERACAO: "success",
  CONCLUIDO: "neutral",
  RECUSADO: "danger",
};

function classificarChamado(chamado: ChamadoSvo): StatusOperacionalChamado {
  if (chamado.statusTriagem === "EM_ANALISE") return "EM_ANALISE";
  if (chamado.statusTriagem === "RECUSADO") return "RECUSADO";
  if (!chamado.ordemColeta) return "AGUARDANDO_ORDEM";
  if (chamado.ordemColeta.status === "CONCLUIDA") return "CONCLUIDO";
  return "EM_OPERACAO";
}

function rotuloStatusViatura(status: string): {
  label: string;
  variant: "success" | "info" | "warning" | "neutral" | "danger";
} {
  if (status === "DISPONIVEL") return { label: "Disponível", variant: "success" };
  if (status === "EM_VIAGEM") return { label: "Em coleta", variant: "info" };
  if (status === "DESINFECCAO") return { label: "Em desinfecção", variant: "warning" };
  if (status === "MANUTENCAO") return { label: "Em manutenção", variant: "danger" };
  return { label: status, variant: "neutral" };
}

function nomeMotorista(motorista: MotoristaSvo): string {
  const nome = motorista.usuario?.nome?.trim();
  return nome ? `${nome} (CNH ${motorista.numeroCnh})` : `CNH ${motorista.numeroCnh}`;
}

export const SvoPage: React.FC = () => {
  const { user } = useAuth();

  const [indicadores, setIndicadores] = useState<IndicadoresSvo>(INDICADORES_VAZIOS);
  const [chamados, setChamados] = useState<ChamadoSvo[]>([]);
  const [viaturas, setViaturas] = useState<ViaturaSvo[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaSvo[]>([]);

  const [etapa, setEtapa] = useState<EtapaFiltroSvo>("TODOS");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [processandoAcaoId, setProcessandoAcaoId] = useState<string | null>(null);

  const [aviso, setAviso] = useState("");
  const [erroPagina, setErroPagina] = useState("");
  const [erroRecursos, setErroRecursos] = useState("");
  const [erroModal, setErroModal] = useState("");

  const [selecionado, setSelecionado] = useState<ChamadoSvo | null>(null);
  const [modal, setModal] = useState<ModalSvo>(null);

  const [novoChamado, setNovoChamado] = useState({
    nomeFalecido: "",
    enderecoOcorrencia: "",
    relatoOcorrencia: "",
  });
  const [justificativa, setJustificativa] = useState("");
  const [viaturaId, setViaturaId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [numeroDeclaracaoObito, setNumeroDeclaracaoObito] = useState("");

  // Carrega chamados paginados e filtrados diretamente da API
  useEffect(() => {
    let cancelado = false;

    obterChamadosSvo({
      etapa: etapa === "TODOS" ? undefined : etapa,
      busca: busca.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((resposta) => {
        if (cancelado) return;
        setChamados(resposta.data);
        setTotalRegistros(resposta.meta.total);
        setTotalPages(Math.max(1, resposta.meta.totalPages));
        if (page > Math.max(1, resposta.meta.totalPages)) {
          setPage(Math.max(1, resposta.meta.totalPages));
        }
        setErroPagina("");
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroPagina(
          extrairErroSvo(
            erro,
            "Não foi possível carregar os chamados do SVO. Verifique sua conexão e tente novamente.",
          ),
        );
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [etapa, busca, page, reloadTick]);

  // Carrega indicadores, viaturas SVO e motoristas disponíveis
  useEffect(() => {
    let cancelado = false;

    Promise.all([obterIndicadoresSvo(), obterViaturasSvo(), obterMotoristasSvo()])
      .then(([ind, listaViaturas, listaMotoristas]) => {
        if (cancelado) return;
        setIndicadores(ind);
        setViaturas(listaViaturas);
        setMotoristas(listaMotoristas);
        setErroRecursos("");
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroRecursos(
          extrairErroSvo(erro, "Não foi possível atualizar os indicadores e viaturas do SVO."),
        );
      });

    return () => {
      cancelado = true;
    };
  }, [reloadTick]);

  const dispararRecarregamento = (novaPagina?: number) => {
    setCarregando(true);
    if (novaPagina !== undefined) {
      setPage(novaPagina);
    }
    setReloadTick((atual) => atual + 1);
  };

  const handleFiltroChange = (novaEtapa: EtapaFiltroSvo) => {
    if (novaEtapa === etapa && page === 1) return;
    setCarregando(true);
    setEtapa(novaEtapa);
    setPage(1);
  };

  const handleBuscaChange = (valor: string) => {
    setCarregando(true);
    setBusca(valor);
    setPage(1);
  };

  const fecharModal = () => {
    if (enviando) return;
    setModal(null);
    setSelecionado(null);
    setJustificativa("");
    setErroModal("");
  };

  const viaturasElegiveis = viaturas.filter(
    (v) =>
      (v.status === "DISPONIVEL" || v.status === "EM_VIAGEM") &&
      v.ocupacaoAtual < v.capacidadeMaxima,
  );

  const abrirRegistro = () => {
    if (enviando) return;
    setNovoChamado({
      nomeFalecido: "",
      enderecoOcorrencia: "",
      relatoOcorrencia: "",
    });
    setSelecionado(null);
    setErroModal("");
    setModal("REGISTRO");
  };

  const handleRegistrarChamado = async () => {
    if (enviando) return;
    setEnviando(true);
    setErroModal("");

    try {
      const criado = await criarChamadoSvo({
        nomeFalecido: novoChamado.nomeFalecido.trim(),
        enderecoOcorrencia: novoChamado.enderecoOcorrencia.trim(),
        relatoOcorrencia: novoChamado.relatoOcorrencia.trim(),
      });
      setModal(null);
      setSelecionado(null);
      setEtapa("TODOS");
      setBusca("");
      setAviso(
        `Chamado ${criado.numeroProtocolo ?? criado.id} registrado com sucesso e incluído na fila de triagem.`,
      );
      dispararRecarregamento(1);
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível registrar o chamado."));
    } finally {
      setEnviando(false);
    }
  };

  const abrirTriagem = (chamado: ChamadoSvo) => {
    if (enviando) return;
    setSelecionado(chamado);
    setJustificativa(chamado.justificativaTriagem ?? "");
    setErroModal("");
    setModal("TRIAGEM");
  };

  const handleConcluirTriagem = async (decisao: "APROVAR" | "RECUSAR") => {
    if (!selecionado || enviando) return;
    if (decisao === "RECUSAR" && justificativa.trim().length < 3) {
      setErroModal("Informe uma justificativa com pelo menos 3 caracteres para recusar o chamado.");
      return;
    }

    setEnviando(true);
    setErroModal("");

    try {
      const textoJustificativa = justificativa.trim();
      const atualizado = await triarChamadoSvo(selecionado.id, {
        decisao,
        ...(textoJustificativa ? { justificativa: textoJustificativa } : {}),
      });
      const protocolo = atualizado.numeroProtocolo ?? selecionado.numeroProtocolo ?? selecionado.id;
      setModal(null);
      setSelecionado(null);
      setJustificativa("");
      setAviso(
        decisao === "APROVAR"
          ? `Triagem aprovada para ${protocolo}. Emita a ordem de coleta para despachar a viatura.`
          : `Chamado ${protocolo} recusado na triagem com justificativa registrada.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível registrar a triagem."));
    } finally {
      setEnviando(false);
    }
  };

  const selecionarMotoristaPadraoParaViatura = (
    idViatura: string,
    listaMotoristas: MotoristaSvo[],
  ) => {
    const viatura = viaturas.find((v) => v.id === idViatura);
    if (viatura?.motoristaAtual?.id) {
      return viatura.motoristaAtual.id;
    }
    const disponivel = listaMotoristas.find((m) => !m.status || m.status === "DISPONIVEL");
    return disponivel?.id ?? "";
  };

  const abrirEmissaoOrdem = (chamado: ChamadoSvo) => {
    if (enviando) return;
    const primeiraElegivel = viaturasElegiveis[0];
    const idViaturaInicial = primeiraElegivel?.id ?? "";
    setSelecionado(chamado);
    setViaturaId(idViaturaInicial);
    setMotoristaId(selecionarMotoristaPadraoParaViatura(idViaturaInicial, motoristas));
    setNumeroDeclaracaoObito("");
    setErroModal("");
    setModal("ORDEM");
  };

  const handleEmitirOrdem = async () => {
    if (!selecionado || enviando) return;
    if (!viaturaId || !motoristaId) {
      setErroModal("Selecione a viatura SVO e o motorista responsável.");
      return;
    }

    setEnviando(true);
    setErroModal("");

    try {
      const viaturaEscolhida = viaturas.find((v) => v.id === viaturaId);
      const decl = numeroDeclaracaoObito.trim();
      await criarOrdemColetaSvo(selecionado.id, {
        veiculoId: viaturaId,
        motoristaId,
        ...(decl ? { numeroDeclaracaoObito: decl } : {}),
      });
      const protocolo = selecionado.numeroProtocolo ?? selecionado.id;
      setModal(null);
      setSelecionado(null);
      setAviso(
        `Ordem de coleta emitida para ${protocolo}${viaturaEscolhida ? ` · ${viaturaEscolhida.modelo} (${viaturaEscolhida.placa})` : ""}.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroModal(extrairErroSvo(erro, "Não foi possível emitir a ordem de coleta."));
    } finally {
      setEnviando(false);
    }
  };

  const handleConcluirColeta = async (chamado: ChamadoSvo) => {
    if (processandoAcaoId) return;
    setProcessandoAcaoId(chamado.id);
    setErroPagina("");

    try {
      await concluirColetaSvo(chamado.id);
      const protocolo = chamado.numeroProtocolo ?? chamado.id;
      setAviso(
        `Coleta do chamado ${protocolo} concluída. Quando não houver outras ordens ativas na viatura, ela entra em desinfecção obrigatória.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroPagina(extrairErroSvo(erro, "Não foi possível concluir a ordem de coleta."));
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  const handleConcluirDesinfeccao = async (viatura: ViaturaSvo) => {
    if (processandoAcaoId) return;
    setProcessandoAcaoId(viatura.id);
    setErroPagina("");

    try {
      await concluirDesinfeccaoSvo(viatura.id);
      setAviso(
        `Desinfecção confirmada: viatura ${viatura.modelo} (${viatura.placa}) liberada para novas coletas.`,
      );
      dispararRecarregamento();
    } catch (erro: unknown) {
      setErroPagina(extrairErroSvo(erro, "Não foi possível confirmar a desinfecção da viatura."));
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  const abrirDetalhes = (chamado: ChamadoSvo) => {
    if (enviando) return;
    setSelecionado(chamado);
    setErroModal("");
    setModal("DETALHE");
  };

  const viaturaDaOrdem = viaturas.find((v) => v.id === viaturaId);
  const motoristasParaOrdem = viaturaDaOrdem?.motoristaAtual
    ? motoristas.filter((m) => m.id === viaturaDaOrdem.motoristaAtual?.id)
    : motoristas.filter((m) => !m.status || m.status === "DISPONIVEL");

  const registroValido =
    novoChamado.nomeFalecido.trim().length >= 2 &&
    novoChamado.enderecoOcorrencia.trim().length >= 3 &&
    novoChamado.relatoOcorrencia.trim().length >= 5;

  const modalTitulo =
    modal === "REGISTRO"
      ? "Registrar chamado SVO"
      : modal === "TRIAGEM"
        ? "Triagem do chamado"
        : modal === "ORDEM"
          ? "Emitir ordem de coleta"
          : "Detalhes do chamado";

  const modalDescricao =
    modal === "REGISTRO"
      ? "Registre os dados recebidos por telefone para iniciar o atendimento na central SVO."
      : modal === "TRIAGEM"
        ? "Avalie o relato da ocorrência e registre a decisão de triagem."
        : modal === "ORDEM"
          ? "Aloque uma viatura exclusiva do SVO e um condutor habilitado respeitando o limite de capacidade."
          : "Resumo completo do atendimento, triagem e despacho operacional.";

  const selecionadoStatus = selecionado ? classificarChamado(selecionado) : null;

  const modalFooter =
    modal === "REGISTRO" ? (
      <>
        <Button variant="outline" onClick={fecharModal} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={handleRegistrarChamado} disabled={!registroValido || enviando}>
          {enviando ? "Registrando..." : "Salvar chamado"}
        </Button>
      </>
    ) : modal === "TRIAGEM" ? (
      <>
        <Button variant="outline" onClick={fecharModal} disabled={enviando}>
          Voltar
        </Button>
        <Button
          variant="danger"
          onClick={() => handleConcluirTriagem("RECUSAR")}
          disabled={enviando || justificativa.trim().length < 3}
        >
          {enviando ? "Salvando..." : "Recusar chamado"}
        </Button>
        <Button onClick={() => handleConcluirTriagem("APROVAR")} disabled={enviando}>
          {enviando ? "Salvando..." : "Aprovar triagem"}
        </Button>
      </>
    ) : modal === "ORDEM" ? (
      <>
        <Button variant="outline" onClick={fecharModal} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          onClick={handleEmitirOrdem}
          disabled={
            enviando ||
            !!erroRecursos ||
            !viaturaDaOrdem ||
            !motoristasParaOrdem.some((motorista) => motorista.id === motoristaId)
          }
        >
          {enviando ? "Emitindo..." : "Emitir ordem de coleta"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={fecharModal}>
          Fechar
        </Button>
        {selecionado && selecionadoStatus === "EM_ANALISE" && (
          <Button onClick={() => abrirTriagem(selecionado)}>Realizar triagem</Button>
        )}
        {selecionado && selecionadoStatus === "AGUARDANDO_ORDEM" && (
          <Button onClick={() => abrirEmissaoOrdem(selecionado)}>Emitir ordem</Button>
        )}
      </>
    );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Operação especializada
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Central de operações SVO
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chamados, triagem e disponibilidade das viaturas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Acesso
            </p>
            <p className="text-xs font-bold text-slate-700">
              {user?.roles.includes("ADMIN") ? "Administrador" : "Atendente SVO"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => dispararRecarregamento()}
              disabled={carregando}
              aria-label="Atualizar dados SVO"
              leftIcon={<RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />}
            >
              Atualizar
            </Button>
            <Button onClick={abrirRegistro} leftIcon={<Plus className="h-4 w-4" />}>
              Registrar chamado
            </Button>
          </div>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {aviso}
          </span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setAviso("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(erroPagina || erroRecursos) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erroPagina || erroRecursos}
          </span>
          <button
            type="button"
            aria-label="Fechar erro"
            onClick={() => {
              setErroPagina("");
              setErroRecursos("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section aria-label="Indicadores SVO" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          icon={Phone}
          label="Chamados registrados"
          value={indicadores.total}
          caption={`${indicadores.aprovados} aprovados`}
          tone="blue"
        />
        <Metric
          icon={Clock3}
          label="Aguardando triagem"
          value={indicadores.emAnalise}
          caption={`${indicadores.aguardandoOrdem} aguardando ordem`}
          tone="amber"
        />
        <Metric
          icon={Activity}
          label="Coletas em andamento"
          value={indicadores.coletasEmAndamento}
          caption="Ordens ativas"
          tone="rose"
        />
        <Metric
          icon={Ambulance}
          label="Viaturas disponíveis"
          value={`${indicadores.viaturasDisponiveis}/${indicadores.totalViaturas || viaturas.length}`}
          caption="Liberadas para despacho"
          tone="green"
        />
      </section>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Fila de chamados</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {totalRegistros}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Acompanhe o atendimento, a triagem e a execução das ordens de coleta.
              </p>
            </div>
            <label className="relative w-full sm:max-w-[250px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Buscar chamado"
                value={busca}
                onChange={(e) => handleBuscaChange(e.target.value)}
                placeholder="Protocolo, nome ou endereço"
                className="pl-9"
              />
            </label>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFiltroChange(f.id)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 pb-3 text-xs font-semibold transition-colors",
                  etapa === f.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {carregando && chamados.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Carregando chamados do SVO...
              </div>
            ) : (
              chamados.map((c) => {
                const statusOp = classificarChamado(c);
                const protocolo = c.numeroProtocolo ?? c.id;
                const processandoEste = processandoAcaoId === c.id;

                return (
                  <article
                    key={c.id}
                    className="p-4 transition-colors hover:bg-slate-50/70 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold tracking-wide text-slate-700">
                            {protocolo}
                          </span>
                          <Badge size="sm" variant={STATUS_CHAMADO_VARIANT[statusOp]} dot>
                            {STATUS_CHAMADO_LABEL[statusOp]}
                          </Badge>
                          {c.ordemColeta?.veiculo && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                              {c.ordemColeta.veiculo.placa}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-800">
                          {c.nomeFalecido || "Identificação não informada"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {c.enderecoOcorrencia || "Endereço não informado"}
                          </span>
                          {c.ordemColeta?.numeroDeclaracaoObito && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              DO: {c.ordemColeta.numeroDeclaracaoObito}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {statusOp === "EM_ANALISE" && (
                          <Button size="sm" onClick={() => abrirTriagem(c)}>
                            Iniciar triagem
                          </Button>
                        )}
                        {statusOp === "AGUARDANDO_ORDEM" && (
                          <Button size="sm" onClick={() => abrirEmissaoOrdem(c)}>
                            Emitir ordem
                          </Button>
                        )}
                        {statusOp === "EM_OPERACAO" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConcluirColeta(c)}
                            disabled={processandoEste}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {processandoEste ? "Concluindo..." : "Concluir coleta"}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirDetalhes(c)}
                          aria-label={`Ver detalhes ${protocolo}`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            {!carregando && chamados.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                Nenhum chamado encontrado para os filtros selecionados.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalRegistros}{" "}
              {totalRegistros === 1 ? "chamado" : "chamados"})
            </span>
            <div className="flex items-center gap-2">
              {(busca || etapa !== "TODOS") && (
                <button
                  type="button"
                  onClick={() => {
                    setCarregando(true);
                    setBusca("");
                    setEtapa("TODOS");
                    setPage(1);
                  }}
                  className="mr-2 font-semibold text-slate-700 hover:text-blue-700"
                >
                  Limpar filtros <ArrowUpRight className="inline h-3.5 w-3.5" />
                </button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || carregando}
                onClick={() => {
                  setCarregando(true);
                  setPage((atual) => Math.max(1, atual - 1));
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || carregando}
                onClick={() => {
                  setCarregando(true);
                  setPage((atual) => Math.min(totalPages, atual + 1));
                }}
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Painel das viaturas SVO</h2>
              <p className="mt-1 text-xs text-slate-500">
                Capacidade operacional e status sanitário da frota exclusiva.
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Ambulance className="h-4.5 w-4.5" />
            </span>
          </div>

          <div className="space-y-3 p-4">
            {viaturas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                Nenhuma viatura cadastrada na frota exclusiva do SVO.
              </div>
            ) : (
              viaturas.map((v) => {
                const disponivel = v.status === "DISPONIVEL";
                const desinfec = v.status === "DESINFECCAO";
                const infoStatus = rotuloStatusViatura(v.status);
                const cap = Math.max(1, v.capacidadeMaxima);
                const percentual = Math.min(100, Math.round((v.ocupacaoAtual / cap) * 100));
                const liberandoEsta = processandoAcaoId === v.id;

                return (
                  <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            disponivel
                              ? "bg-emerald-50 text-emerald-600"
                              : desinfec
                                ? "bg-amber-50 text-amber-600"
                                : "bg-blue-50 text-blue-600",
                          )}
                        >
                          <Ambulance className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{v.modelo}</p>
                          <p className="font-mono text-[11px] text-slate-500">{v.placa}</p>
                        </div>
                      </div>
                      <Badge size="sm" dot variant={infoStatus.variant}>
                        {infoStatus.label}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {v.motoristaAtual?.nome || "Sem condutor alocado"}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {v.ocupacaoAtual}/{v.capacidadeMaxima} vagas
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          v.ocupacaoAtual >= v.capacidadeMaxima
                            ? "bg-rose-500"
                            : v.ocupacaoAtual >= Math.max(1, v.capacidadeMaxima - 1)
                              ? "bg-amber-500"
                              : "bg-blue-500",
                        )}
                        style={{ width: `${percentual}%` }}
                      />
                    </div>

                    {desinfec && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        disabled={liberandoEsta}
                        onClick={() => handleConcluirDesinfeccao(v)}
                      >
                        {liberandoEsta ? "Liberando..." : "Confirmar desinfecção"}{" "}
                        <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}

                    {disponivel && (
                      <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Liberada para nova coleta
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Regra operacional:</strong> a quantidade de coletas ativas respeita a
              capacidade máxima de cada viatura SVO. Ao concluir a entrega, a unidade entra em
              bloqueio sanitário até a confirmação da desinfecção.
            </span>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={modal !== null}
        onClose={fecharModal}
        title={modalTitulo}
        description={modalDescricao}
        size="lg"
        footer={modalFooter}
      >
        {erroModal && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erroModal}</span>
          </div>
        )}

        {modal === "REGISTRO" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome do falecido"
                value={novoChamado.nomeFalecido}
                required
                disabled={enviando}
                onChange={(e) => setNovoChamado((v) => ({ ...v, nomeFalecido: e.target.value }))}
                placeholder="Nome completo informado no atendimento"
              />
              <Input
                label="Endereço da ocorrência"
                value={novoChamado.enderecoOcorrencia}
                required
                disabled={enviando}
                onChange={(e) =>
                  setNovoChamado((v) => ({ ...v, enderecoOcorrencia: e.target.value }))
                }
                placeholder="Rua, número, bairro e município"
              />
            </div>
            <Textarea
              label="Relato da ocorrência"
              value={novoChamado.relatoOcorrencia}
              required
              rows={4}
              disabled={enviando}
              onChange={(e) => setNovoChamado((v) => ({ ...v, relatoOcorrencia: e.target.value }))}
              placeholder="Registre as circunstâncias do óbito, telefone de retorno e informações da ligação."
              helperText="Mínimo de 5 caracteres. O chamado será salvo com status Aguardando triagem."
            />
          </div>
        )}

        {modal === "TRIAGEM" && selecionado && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Protocolo" value={selecionado.numeroProtocolo ?? selecionado.id} />
              <Detail
                label="Nome do falecido"
                value={selecionado.nomeFalecido || "Não informado"}
              />
              <Detail
                label="Endereço da ocorrência"
                value={selecionado.enderecoOcorrencia || "Não informado"}
              />
              <Detail
                label="Atendente responsável"
                value={selecionado.atendente?.nome || "Registrado na central"}
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Relato da ocorrência
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {selecionado.relatoOcorrencia || "Sem relato adicional."}
              </p>
            </div>
            <Textarea
              label="Justificativa / parecer da triagem"
              value={justificativa}
              rows={4}
              disabled={enviando}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Registre os critérios clínicos e operacionais avaliados na triagem..."
              helperText="Obrigatória em caso de recusa (mínimo de 3 caracteres)."
            />
          </div>
        )}

        {modal === "ORDEM" && selecionado && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Triagem aprovada
              </div>
              <p className="mt-1 text-xs text-emerald-800">
                {selecionado.numeroProtocolo ?? selecionado.id} ·{" "}
                {selecionado.nomeFalecido || "Falecido"} ·{" "}
                {selecionado.enderecoOcorrencia || "Local não informado"}
              </p>
              {selecionado.justificativaTriagem && (
                <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                  Parecer: {selecionado.justificativaTriagem}
                </p>
              )}
            </div>

            {viaturasElegiveis.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Não há viatura exclusiva do SVO disponível com vagas livres no momento.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Viatura SVO"
                  value={viaturaId}
                  required
                  disabled={enviando}
                  onChange={(e) => {
                    const novoId = e.target.value;
                    setViaturaId(novoId);
                    setMotoristaId(selecionarMotoristaPadraoParaViatura(novoId, motoristas));
                  }}
                  placeholder="Selecione uma viatura"
                  options={viaturasElegiveis.map((v) => ({
                    value: v.id,
                    label: `${v.modelo} · ${v.placa} (${v.capacidadeMaxima - v.ocupacaoAtual} vaga(s) livre(s))`,
                  }))}
                />
                <Select
                  label="Motorista habilitado"
                  value={motoristaId}
                  required
                  disabled={enviando || motoristasParaOrdem.length === 0}
                  onChange={(e) => setMotoristaId(e.target.value)}
                  placeholder="Selecione um motorista"
                  options={motoristasParaOrdem.map((m) => ({
                    value: m.id,
                    label: nomeMotorista(m),
                  }))}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Número da Declaração de Óbito (opcional)"
                    value={numeroDeclaracaoObito}
                    disabled={enviando}
                    onChange={(e) => setNumeroDeclaracaoObito(e.target.value)}
                    placeholder="Ex.: DO-2026-009841"
                  />
                </div>
              </div>
            )}

            {viaturaDaOrdem && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Placa / Modelo"
                  value={`${viaturaDaOrdem.placa} · ${viaturaDaOrdem.modelo}`}
                />
                <Detail
                  label="Ocupação após despacho"
                  value={`${viaturaDaOrdem.ocupacaoAtual + 1}/${viaturaDaOrdem.capacidadeMaxima} vagas`}
                />
              </div>
            )}
          </div>
        )}

        {modal === "DETALHE" && selecionado && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-600">
                {selecionado.numeroProtocolo ?? selecionado.id}
              </span>
              {selecionadoStatus && (
                <Badge variant={STATUS_CHAMADO_VARIANT[selecionadoStatus]} dot>
                  {STATUS_CHAMADO_LABEL[selecionadoStatus]}
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Detail
                label="Nome do falecido"
                value={selecionado.nomeFalecido || "Não informado"}
              />
              <Detail
                label="Endereço da ocorrência"
                value={selecionado.enderecoOcorrencia || "Não informado"}
              />
              <Detail
                label="Atendente responsável"
                value={selecionado.atendente?.nome || "Registrado na central"}
              />
              <Detail
                label="Declaração de óbito"
                value={selecionado.ordemColeta?.numeroDeclaracaoObito || "Não informada"}
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Relato da ocorrência
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {selecionado.relatoOcorrencia || "Sem relato adicional."}
              </p>
            </div>

            {selecionado.justificativaTriagem && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Parecer da triagem
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {selecionado.justificativaTriagem}
                </p>
              </div>
            )}

            {selecionado.ordemColeta && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Viatura alocada"
                  value={
                    selecionado.ordemColeta.veiculo
                      ? `${selecionado.ordemColeta.veiculo.modelo} (${selecionado.ordemColeta.veiculo.placa})`
                      : "Não informada"
                  }
                />
                <Detail
                  label="Condutor alocado"
                  value={
                    selecionado.ordemColeta.motorista?.usuario?.nome ||
                    selecionado.ordemColeta.motorista?.numeroCnh ||
                    "Não informado"
                  }
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

function Metric({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  caption: string;
  tone: "blue" | "amber" | "rose" | "green";
}) {
  const palette = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card className="rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn("flex h-10 w-10 items-center justify-center rounded-xl", palette[tone])}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold leading-snug text-slate-500 sm:text-xs">
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
        <span className="mb-1 text-[10px] text-slate-400">{caption}</span>
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
