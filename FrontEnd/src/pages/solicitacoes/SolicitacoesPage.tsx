import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import { cn } from "../../lib/utils";
import {
  STATUS_SOLICITACAO_LABEL,
  STATUS_SOLICITACAO_VARIANT,
  TIPO_TRANSPORTE_LABEL,
  type NovaSolicitacaoViagem,
  type SolicitacaoViagem,
  type StatusSolicitacao,
} from "../../types/solicitacao";
import { NovaSolicitacaoModal } from "./NovaSolicitacaoModal";
import { criarSolicitacoesMock } from "./solicitacoesMock";

type FiltroStatus = "TODAS" | "PENDENTE" | "APROVADAS" | "CONCLUIDA" | "RECUSADA";

const FILTROS: { id: FiltroStatus; label: string; status: StatusSolicitacao[] | null }[] = [
  { id: "TODAS", label: "Todas", status: null },
  { id: "PENDENTE", label: "Pendentes", status: ["PENDENTE"] },
  { id: "APROVADAS", label: "Aprovadas", status: ["APROVADA", "EM_TRANSITO"] },
  { id: "CONCLUIDA", label: "Concluídas", status: ["CONCLUIDA"] },
  { id: "RECUSADA", label: "Recusadas", status: ["RECUSADA"] },
];

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

function gerarProtocolo(total: number): string {
  const ano = new Date().getFullYear();
  return `SV-${ano}-${String(143 + total).padStart(4, "0")}`;
}

export const SolicitacoesPage: React.FC = () => {
  const { user } = useAuth();
  const solicitanteNome = user?.nome ?? "Solicitante";

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoViagem[]>(() =>
    criarSolicitacoesMock(solicitanteNome),
  );
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("TODAS");
  const [isNovaOpen, setIsNovaOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<SolicitacaoViagem | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const contagem = useMemo(() => {
    const por = (s: StatusSolicitacao[]) => solicitacoes.filter((x) => s.includes(x.status)).length;
    return {
      total: solicitacoes.length,
      pendentes: por(["PENDENTE"]),
      aprovadas: por(["APROVADA", "EM_TRANSITO"]),
      recusadas: por(["RECUSADA"]),
    };
  }, [solicitacoes]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const statusFiltro = FILTROS.find((f) => f.id === filtro)?.status;
    return solicitacoes
      .filter((s) => !statusFiltro || statusFiltro.includes(s.status))
      .filter(
        (s) =>
          !termo ||
          s.protocolo.toLowerCase().includes(termo) ||
          s.destino.toLowerCase().includes(termo) ||
          s.origem.toLowerCase().includes(termo),
      )
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [solicitacoes, busca, filtro]);

  const handleNovaSolicitacao = async (dados: NovaSolicitacaoViagem) => {
    // Simula latência de rede até a integração com a API.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const nova: SolicitacaoViagem = {
      ...dados,
      id: `sol-${Date.now()}`,
      protocolo: gerarProtocolo(solicitacoes.length),
      solicitanteNome,
      status: "PENDENTE",
      criadoEm: new Date().toISOString(),
    };
    setSolicitacoes((prev) => [nova, ...prev]);
    setIsNovaOpen(false);
    setFiltro("TODAS");
    setMensagemSucesso(
      `Solicitação ${nova.protocolo} enviada! Aguarde a análise do Gestor de Frota.`,
    );
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
        <button
          type="button"
          onClick={() => setSelecionada(s)}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Ver detalhes da viagem"
          aria-label={`Ver detalhes da solicitação ${s.protocolo}`}
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Minhas Solicitações de Viagem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Solicite transporte oficial e acompanhe o andamento das suas viagens.
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

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="w-full lg:max-w-md">
          <Input
            placeholder="Buscar por protocolo, origem ou destino..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            aria-label="Buscar solicitações"
          />
        </div>
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
              onClick={() => setFiltro(f.id)}
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

      <Table
        columns={columns}
        data={filtradas}
        keyExtractor={(s) => s.id}
        emptyMessage="Nenhuma solicitação encontrada com esse filtro ou busca."
      />

      <NovaSolicitacaoModal
        isOpen={isNovaOpen}
        onClose={() => setIsNovaOpen(false)}
        onSubmit={handleNovaSolicitacao}
        setorPadrao="LACEN"
      />

      <DetalhesSolicitacaoModal solicitacao={selecionada} onClose={() => setSelecionada(null)} />
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
  onClose: () => void;
}> = ({ solicitacao: s, onClose }) => (
  <Modal
    isOpen={s !== null}
    onClose={onClose}
    size="lg"
    title={s ? `Solicitação ${s.protocolo}` : ""}
    description={s ? `Enviada em ${formatarDataHora(s.criadoEm)} por ${s.solicitanteNome}` : ""}
    footer={
      <Button variant="outline" onClick={onClose}>
        Fechar
      </Button>
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
