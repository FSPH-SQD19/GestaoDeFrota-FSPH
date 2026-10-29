import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Eye,
  ArrowRight,
  CalendarClock,
  Car,
  UserRound,
  CheckCircle2,
  Clock,
  XCircle,
  ClipboardList,
  Siren,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { cn } from "../../lib/utils";
import {
  aprovarSolicitacaoApi,
  criarSolicitacaoApi,
  listarSolicitacoesApi,
  recusarSolicitacaoApi,
} from "../../services/solicitacoesService";
import {
  SETORES_FSPH,
  STATUS_SOLICITACAO_LABEL,
  STATUS_SOLICITACAO_VARIANT,
  TIPO_TRANSPORTE_LABEL,
  type AprovarSolicitacaoInput,
  type ContagemPorStatus,
  type MotoristaDisponivelOption,
  type NovaSolicitacaoViagem,
  type RecusarSolicitacaoInput,
  type SolicitacaoViagem,
  type StatusSolicitacao,
  type UrgenciaSolicitacao,
  type VeiculoDisponivelOption,
} from "../../types/solicitacao";
import { AnalisarSolicitacaoModal, type ModoAnaliseSolicitacao } from "./AnalisarSolicitacaoModal";
import { NovaSolicitacaoModal } from "./NovaSolicitacaoModal";

type FiltroStatus = "TODAS" | "PENDENTE" | "APROVADAS" | "CONCLUIDA" | "RECUSADA";
type FiltroUrgencia = "TODAS" | UrgenciaSolicitacao;

const FILTROS: { id: FiltroStatus; label: string; status: StatusSolicitacao[] | null }[] = [
  { id: "TODAS", label: "Todas", status: null },
  { id: "PENDENTE", label: "Pendentes", status: ["PENDENTE"] },
  { id: "APROVADAS", label: "Aprovadas", status: ["APROVADA", "EM_TRANSITO"] },
  { id: "CONCLUIDA", label: "Concluídas", status: ["CONCLUIDA"] },
  { id: "RECUSADA", label: "Recusadas", status: ["RECUSADA"] },
];

const PAGE_SIZE = 20;

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

function pesoFilaGestor(s: SolicitacaoViagem): number {
  if (s.status === "PENDENTE" && s.urgencia === "URGENTE") return 0;
  if (s.status === "PENDENTE") return 1;
  return 2;
}

export const SolicitacoesPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const isGestor = hasRole(["GESTOR", "ADMIN"]);

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoViagem[]>([]);
  const [pendentesUrgentes, setPendentesUrgentes] = useState<SolicitacaoViagem[]>([]);
  const [porStatusApi, setPorStatusApi] = useState<ContagemPorStatus | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("TODAS");
  const [filtroSetor, setFiltroSetor] = useState<string>("TODOS");
  const [filtroUrgencia, setFiltroUrgencia] = useState<FiltroUrgencia>("TODAS");

  const [isNovaOpen, setIsNovaOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<SolicitacaoViagem | null>(null);
  const [analiseAlvo, setAnaliseAlvo] = useState<{
    solicitacao: SolicitacaoViagem;
    modoInicial: ModoAnaliseSolicitacao;
  } | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const statusSelecionados = useMemo(
    () => FILTROS.find((f) => f.id === filtro)?.status ?? undefined,
    [filtro],
  );

  // Carrega a listagem paginada aplicando busca e filtros diretamente na API
  useEffect(() => {
    let ativa = true;
    void listarSolicitacoesApi(
      {
        page,
        pageSize: PAGE_SIZE,
        status: statusSelecionados,
        urgencia: filtroUrgencia === "TODAS" ? undefined : filtroUrgencia,
        setorOrigem: filtroSetor === "TODOS" ? undefined : filtroSetor,
        busca: busca.trim() || undefined,
      },
      token,
    )
      .then((resposta) => {
        if (!ativa) return;
        setErroCarregamento(null);
        setSolicitacoes(resposta.data);
        setPorStatusApi(resposta.meta.porStatus);
        setTotalPages(Math.max(1, resposta.meta.totalPages));
      })
      .catch((err: unknown) => {
        if (!ativa) return;
        setErroCarregamento(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as solicitações de viagem.",
        );
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });

    return () => {
      ativa = false;
    };
  }, [page, statusSelecionados, filtroUrgencia, filtroSetor, busca, token, reloadTick]);

  // Carrega a fila prioritária URGENTE completa (independente da página atual da tabela)
  useEffect(() => {
    if (!isGestor) return;

    let ativa = true;
    void listarSolicitacoesApi(
      {
        page: 1,
        pageSize: 100,
        status: ["PENDENTE"],
        urgencia: "URGENTE",
      },
      token,
    )
      .then((resposta) => {
        if (ativa) {
          setPendentesUrgentes(resposta.data);
        }
      })
      .catch(() => {
        // Caso falhe, o erro principal já é exibido pela consulta da tabela.
      });

    return () => {
      ativa = false;
    };
  }, [isGestor, token, reloadTick]);

  const dispararRecarregamento = (resetarPagina = false) => {
    setCarregando(true);
    setErroCarregamento(null);
    if (resetarPagina) {
      setPage(1);
    }
    setReloadTick((t) => t + 1);
  };

  const handleBuscaChange = (valor: string) => {
    setCarregando(true);
    setBusca(valor);
    setPage(1);
  };

  const handleFiltroStatusChange = (novoFiltro: FiltroStatus) => {
    if (novoFiltro === filtro) return;
    setCarregando(true);
    setFiltro(novoFiltro);
    setPage(1);
  };

  const handleFiltroSetorChange = (novoSetor: string) => {
    setCarregando(true);
    setFiltroSetor(novoSetor);
    setPage(1);
  };

  const handleFiltroUrgenciaChange = (novaUrgencia: FiltroUrgencia) => {
    setCarregando(true);
    setFiltroUrgencia(novaUrgencia);
    setPage(1);
  };

  const handleMudarPagina = (novaPagina: number) => {
    setCarregando(true);
    setPage(novaPagina);
  };

  const opcoesSetor = useMemo(() => {
    const conjunto = new Set<string>(SETORES_FSPH);
    for (const item of solicitacoes) {
      if (item.setorOrigem) conjunto.add(item.setorOrigem);
    }
    for (const item of pendentesUrgentes) {
      if (item.setorOrigem) conjunto.add(item.setorOrigem);
    }
    return [
      { value: "TODOS", label: "Todos os setores" },
      ...Array.from(conjunto).map((s) => ({ value: s, label: s })),
    ];
  }, [solicitacoes, pendentesUrgentes]);

  const contagem = useMemo(() => {
    if (porStatusApi) {
      const totalApi =
        porStatusApi.PENDENTE +
        porStatusApi.APROVADA +
        porStatusApi.EM_TRANSITO +
        porStatusApi.CONCLUIDA +
        porStatusApi.RECUSADA;

      return {
        total: totalApi,
        pendentes: porStatusApi.PENDENTE,
        aprovadas: porStatusApi.APROVADA + porStatusApi.EM_TRANSITO,
        recusadas: porStatusApi.RECUSADA,
      };
    }

    const por = (s: StatusSolicitacao[]) => solicitacoes.filter((x) => s.includes(x.status)).length;
    return {
      total: solicitacoes.length,
      pendentes: por(["PENDENTE"]),
      aprovadas: por(["APROVADA", "EM_TRANSITO"]),
      recusadas: por(["RECUSADA"]),
    };
  }, [solicitacoes, porStatusApi]);

  const linhasOrdenadas = useMemo(() => {
    return [...solicitacoes].sort((a, b) => {
      if (isGestor) {
        const diffPeso = pesoFilaGestor(a) - pesoFilaGestor(b);
        if (diffPeso !== 0) return diffPeso;
      }
      return b.criadoEm.localeCompare(a.criadoEm);
    });
  }, [solicitacoes, isGestor]);

  const handleNovaSolicitacao = async (dados: NovaSolicitacaoViagem) => {
    const nova = await criarSolicitacaoApi(dados, token);
    setIsNovaOpen(false);
    setFiltro("TODAS");
    dispararRecarregamento(true);
    setMensagemSucesso(
      `Solicitação ${nova.protocolo} enviada! Aguarde a análise do Gestor de Frota.`,
    );
  };

  const handleAprovarSolicitacao = async (
    solicitacaoId: string,
    dados: AprovarSolicitacaoInput,
    resumo: { veiculo: VeiculoDisponivelOption; motorista: MotoristaDisponivelOption },
  ) => {
    const atualizada = await aprovarSolicitacaoApi(solicitacaoId, dados, token);
    setAnaliseAlvo(null);
    dispararRecarregamento(false);
    setMensagemSucesso(
      `Solicitação ${atualizada.protocolo} aprovada! Veículo ${resumo.veiculo.placa} e motorista ${resumo.motorista.nome} alocados.`,
    );
  };

  const handleRecusarSolicitacao = async (
    solicitacaoId: string,
    dados: RecusarSolicitacaoInput,
  ) => {
    const atualizada = await recusarSolicitacaoApi(solicitacaoId, dados, token);
    setAnaliseAlvo(null);
    dispararRecarregamento(false);
    setMensagemSucesso(
      `Solicitação ${atualizada.protocolo} recusada e justificativa enviada ao setor solicitante.`,
    );
  };

  const abrirAnalise = (
    solicitacao: SolicitacaoViagem,
    modoInicial: ModoAnaliseSolicitacao = "APROVAR",
  ) => {
    setMensagemSucesso(null);
    setSelecionada(null);
    setAnaliseAlvo({ solicitacao, modoInicial });
  };

  const columns: Column<SolicitacaoViagem>[] = [
    {
      header: "Protocolo",
      render: (s) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono font-bold text-slate-900 text-xs tracking-wider">
            {s.protocolo}
          </span>
          {s.urgencia === "URGENTE" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
              <Siren className="w-3 h-3" /> Urgente
            </span>
          )}
        </div>
      ),
    },
    ...(isGestor
      ? [
          {
            header: "Setor / Solicitante",
            render: (s: SolicitacaoViagem) => (
              <div className="min-w-[150px]">
                <span className="inline-block text-xs font-bold text-slate-900">
                  {s.setorOrigem}
                </span>
                <span className="block text-xs text-slate-500 truncate max-w-[180px]">
                  {s.solicitanteNome}
                </span>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Itinerário",
      render: (s) => (
        <div className="min-w-[220px]">
          <span className="block text-xs text-slate-500 truncate max-w-[280px]">{s.origem}</span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[260px]">{s.destino}</span>
          </span>
        </div>
      ),
    },
    {
      header: "Saída prevista",
      render: (s) => (
        <span className="flex items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap">
          <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
          {formatarDataHora(s.dataHoraPretendida)}
        </span>
      ),
    },
    {
      header: "Transporte",
      render: (s) => (
        <span className="text-xs text-slate-600">{TIPO_TRANSPORTE_LABEL[s.tipoTransporte]}</span>
      ),
    },
    {
      header: "Status",
      render: (s) => (
        <Badge variant={STATUS_SOLICITACAO_VARIANT[s.status]} dot>
          {STATUS_SOLICITACAO_LABEL[s.status]}
        </Badge>
      ),
    },
    {
      header: "Ações",
      render: (s) => (
        <div className="flex items-center gap-1.5">
          {isGestor && s.status === "PENDENTE" && (
            <>
              <button
                type="button"
                onClick={() => abrirAnalise(s, "APROVAR")}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                aria-label={`Aprovar solicitação ${s.protocolo}`}
              >
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => abrirAnalise(s, "RECUSAR")}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                aria-label={`Recusar solicitação ${s.protocolo}`}
              >
                Recusar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelecionada(s)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Ver detalhes da viagem"
            aria-label={`Ver detalhes da solicitação ${s.protocolo}`}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {isGestor ? "Gestão de Solicitações de Viagem" : "Minhas Solicitações de Viagem"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isGestor
              ? "Analise a fila de pedidos dos setores da FSPH, priorize demandas urgentes e aloque veículo e motorista."
              : "Solicite transporte oficial e acompanhe o andamento das suas viagens."}
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setMensagemSucesso(null);
            setIsNovaOpen(true);
          }}
          className="rounded-2xl"
        >
          Nova Solicitação de Viagem
        </Button>
      </div>

      {mensagemSucesso && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {mensagemSucesso}
          </span>
          <button
            type="button"
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {erroCarregamento && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            {erroCarregamento}
          </span>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => dispararRecarregamento(false)}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={ClipboardList}
          label="Total solicitado"
          value={contagem.total}
          tone="neutral"
        />
        <MetricCard
          icon={Clock}
          label="Aguardando aprovação"
          value={contagem.pendentes}
          tone="warning"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Aprovadas / em trânsito"
          value={contagem.aprovadas}
          tone="success"
        />
        <MetricCard icon={XCircle} label="Recusadas" value={contagem.recusadas} tone="danger" />
      </div>

      {/* Destaque de Fila Prioritária (URGENTE) para Gestor / Admin */}
      {isGestor && pendentesUrgentes.length > 0 && (
        <Card className="p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Siren className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-rose-950">
                  Fila de Análise Prioritária — {pendentesUrgentes.length} pedido(s) URGENTE(S)
                  aguardando decisão
                </h2>
                <p className="text-xs text-rose-800">
                  Solicitações urgentes possuem prioridade de alocação na frota administrativa.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendentesUrgentes.map((urg) => (
              <div
                key={urg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-rose-200/80 shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {urg.protocolo}
                    </span>
                    <Badge variant="danger">Urgente</Badge>
                    <span className="text-xs font-semibold text-slate-600">{urg.setorOrigem}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {urg.origem} → {urg.destino}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Saída: {formatarDataHora(urg.dataHoraPretendida)} · Solicitante:{" "}
                    {urg.solicitanteNome}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                    onClick={() => abrirAnalise(urg, "APROVAR")}
                    aria-label={`Analisar pedido urgente ${urg.protocolo}`}
                  >
                    Analisar agora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="w-full lg:max-w-md">
            <Input
              placeholder="Buscar por protocolo, origem ou destino..."
              value={busca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              aria-label="Buscar solicitações"
            />
          </div>

          {isGestor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto lg:min-w-[420px]">
              <Select
                aria-label="Filtrar por setor"
                value={filtroSetor}
                onChange={(e) => handleFiltroSetorChange(e.target.value)}
                options={opcoesSetor}
              />
              <Select
                aria-label="Filtrar por urgência"
                value={filtroUrgencia}
                onChange={(e) => handleFiltroUrgenciaChange(e.target.value as FiltroUrgencia)}
                options={[
                  { value: "TODAS", label: "Todas as urgências" },
                  { value: "URGENTE", label: "Apenas urgentes" },
                  { value: "NORMAL", label: "Urgência normal" },
                ]}
              />
            </div>
          )}

          <div
            className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto"
            role="tablist"
          >
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => handleFiltroStatusChange(f.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  filtro === f.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={linhasOrdenadas}
        keyExtractor={(s) => s.id}
        isLoading={carregando}
        emptyMessage="Nenhuma solicitação encontrada com esse filtro ou busca."
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500">
            Página <strong className="text-slate-800">{page}</strong> de{" "}
            <strong className="text-slate-800">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || carregando}
              onClick={() => handleMudarPagina(Math.max(1, page - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || carregando}
              onClick={() => handleMudarPagina(Math.min(totalPages, page + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <NovaSolicitacaoModal
        isOpen={isNovaOpen}
        onClose={() => setIsNovaOpen(false)}
        onSubmit={handleNovaSolicitacao}
        setorPadrao="LACEN"
      />

      <DetalhesSolicitacaoModal
        solicitacao={selecionada}
        isGestor={isGestor}
        onClose={() => setSelecionada(null)}
        onAnalisar={(s, modo) => abrirAnalise(s, modo)}
      />

      <AnalisarSolicitacaoModal
        key={`${analiseAlvo?.solicitacao.id ?? "closed"}-${analiseAlvo?.modoInicial ?? "APROVAR"}`}
        solicitacao={analiseAlvo?.solicitacao ?? null}
        modoInicial={analiseAlvo?.modoInicial ?? "APROVAR"}
        token={token}
        onClose={() => setAnaliseAlvo(null)}
        onAprovar={handleAprovarSolicitacao}
        onRecusar={handleRecusarSolicitacao}
      />
    </div>
  );
};

/* ---------- Subcomponentes ---------- */

const toneStyles = {
  neutral: {
    card: "border-slate-200/80 bg-white",
    icon: "bg-slate-100 text-slate-700",
    text: "text-slate-900",
  },
  warning: {
    card: "border-amber-200/80 bg-amber-50/30",
    icon: "bg-amber-100 text-amber-700",
    text: "text-amber-900",
  },
  success: {
    card: "border-emerald-200/80 bg-emerald-50/30",
    icon: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-900",
  },
  danger: {
    card: "border-rose-200/80 bg-rose-50/30",
    icon: "bg-rose-100 text-rose-700",
    text: "text-rose-900",
  },
};

const MetricCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof toneStyles;
}> = ({ icon: Icon, label, value, tone }) => (
  <Card className={cn("p-4.5 rounded-2xl border", toneStyles[tone].card)}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-600 font-medium">{label}</span>
      <span
        className={cn("w-8 h-8 rounded-xl flex items-center justify-center", toneStyles[tone].icon)}
      >
        <Icon className="w-4 h-4" />
      </span>
    </div>
    <span className={cn("block mt-1 text-2xl font-bold", toneStyles[tone].text)}>{value}</span>
  </Card>
);

const InfoItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {label}
    </span>
    <span className="block text-sm text-slate-800 mt-0.5">{children}</span>
  </div>
);

const DetalhesSolicitacaoModal: React.FC<{
  solicitacao: SolicitacaoViagem | null;
  isGestor: boolean;
  onClose: () => void;
  onAnalisar: (solicitacao: SolicitacaoViagem, modo: ModoAnaliseSolicitacao) => void;
}> = ({ solicitacao: s, isGestor, onClose, onAnalisar }) => (
  <Modal
    isOpen={s !== null}
    onClose={onClose}
    size="lg"
    title={s ? `Solicitação ${s.protocolo}` : ""}
    description={s ? `Enviada em ${formatarDataHora(s.criadoEm)} por ${s.solicitanteNome}` : ""}
    footer={
      <>
        {isGestor && s?.status === "PENDENTE" && (
          <>
            <Button variant="danger" onClick={() => onAnalisar(s, "RECUSAR")}>
              Recusar
            </Button>
            <Button variant="primary" onClick={() => onAnalisar(s, "APROVAR")}>
              Aprovar e Alocar
            </Button>
          </>
        )}
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </>
    }
  >
    {s && (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_SOLICITACAO_VARIANT[s.status]} dot>
            {STATUS_SOLICITACAO_LABEL[s.status]}
          </Badge>
          {s.urgencia === "URGENTE" && <Badge variant="danger">Urgente</Badge>}
        </div>

        {s.status === "RECUSADA" && s.motivoRecusa && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <span className="block font-semibold mb-0.5">Motivo da recusa</span>
            {s.motivoRecusa}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoItem label="Origem">{s.origem}</InfoItem>
          <InfoItem label="Destino">{s.destino}</InfoItem>
          <InfoItem label="Saída prevista">{formatarDataHora(s.dataHoraPretendida)}</InfoItem>
          <InfoItem label="Retorno previsto">
            {formatarDataHora(s.dataHoraRetornoPrevista)}
          </InfoItem>
          <InfoItem label="Setor">{s.setorOrigem}</InfoItem>
          <InfoItem label="Transporte">
            {TIPO_TRANSPORTE_LABEL[s.tipoTransporte]} · {s.quantidadePassageiros} passageiro(s)
          </InfoItem>
        </div>

        <InfoItem label="Justificativa">{s.justificativa}</InfoItem>
        {s.observacoes && <InfoItem label="Observações">{s.observacoes}</InfoItem>}

        {(s.veiculoAlocado || s.motoristaAlocado) && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {s.veiculoAlocado && (
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                  <Car className="w-4 h-4 text-slate-700" />
                </span>
                <InfoItem label="Veículo alocado">
                  <span className="font-mono font-bold">{s.veiculoAlocado.placa}</span> ·{" "}
                  {s.veiculoAlocado.modelo}
                </InfoItem>
              </div>
            )}
            {s.motoristaAlocado && (
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                  <UserRound className="w-4 h-4 text-slate-700" />
                </span>
                <InfoItem label="Motorista">{s.motoristaAlocado.nome}</InfoItem>
              </div>
            )}
          </div>
        )}

        {s.status === "PENDENTE" && (
          <p className="text-xs text-slate-500">
            Veículo e motorista serão exibidos aqui após a aprovação do Gestor de Frota.
          </p>
        )}
      </div>
    )}
  </Modal>
);
