import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Car,
  ClipboardList,
  Clock3,
  RefreshCw,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import {
  STATUS_SOLICITACAO_LABEL,
  STATUS_SOLICITACAO_VARIANT,
  type SolicitacaoViagem,
  type StatusSolicitacao,
} from "../../types/solicitacao";

import type { AlertaDocumentoVeiculo } from "../../types/documentoVeiculo";
import { ListaAlertasDocumentos } from "../veiculos/ListaAlertasDocumentos";

type StatusVeiculo = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO" | "INATIVO";
type TipoFrota = "ADMINISTRATIVA" | "SVO";

interface ContagemFrota {
  total: number;
  totalGeral: number;
  porStatus: Record<StatusVeiculo, number>;
}

interface SolicitacoesResponse {
  data: SolicitacaoViagem[];
  meta: {
    total: number;
    porStatus: Record<StatusSolicitacao, number>;
  };
}

interface AlertaCnh {
  motoristaId: string;
  nome: string;
  dataVencimento: string;
  situacao: "VENCIDO" | "PROXIMO_VENCIMENTO";
}

interface AlertasOperacionais {
  total: number;
  cnh: AlertaCnh[];
  documentos: AlertaDocumentoVeiculo[];
}

interface DashboardData {
  veiculos: ContagemFrota & { porTipoFrota: Record<TipoFrota, ContagemFrota> };
  solicitacoes: SolicitacoesResponse;
  viagensDoDia: number;
  svo: { chamadosAtivos: number; slaMedioRespostaMinutos: number | null };
  alertasOperacionais: AlertasOperacionais;
}

const STATUS_VEICULO_LABEL: Record<StatusVeiculo, string> = {
  DISPONIVEL: "Disponíveis",
  EM_VIAGEM: "Em viagem",
  MANUTENCAO: "Em manutenção",
  DESINFECCAO: "Em desinfecção",
  INATIVO: "Inativos",
};
const STATUS_VEICULO = Object.keys(STATUS_VEICULO_LABEL) as StatusVeiculo[];
const TIPO_FROTA_LABEL: Record<TipoFrota, string> = {
  ADMINISTRATIVA: "Administrativa",
  SVO: "SVO",
};

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dataFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const slaFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatarDataHora(valor?: string | null) {
  return valor ? dataHoraFmt.format(new Date(valor)) : "—";
}

function formatarData(valor: string) {
  return dataFmt.format(new Date(`${valor}T00:00:00Z`));
}

export const DashboardPage: React.FC = () => {
  const { user, sessionKey } = useAuth();
  const [today] = useState(() => new Date());
  const [resultado, setResultado] = useState<{
    sessionKey: typeof sessionKey;
    revisao: number;
    dados: DashboardData | null;
    erro: string;
  } | null>(null);

  const todayFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(today),
    [today],
  );

  const [revisao, setRevisao] = useState(0);
  const atualizarDados = () => setRevisao((valor) => valor + 1);
  const resultadoAtual =
    resultado?.sessionKey === sessionKey && resultado.revisao === revisao ? resultado : null;
  const dados = resultadoAtual?.dados ?? null;
  const isLoading = resultadoAtual === null;
  const errorMessage = resultadoAtual?.erro ?? "";

  useEffect(() => {
    let mounted = true;

    void apiRequest<DashboardData>("/dashboard/resumo")
      .then((resposta) => {
        if (mounted) setResultado({ sessionKey, revisao, dados: resposta, erro: "" });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setResultado({
          sessionKey,
          revisao,
          dados: null,
          erro:
            error instanceof Error ? error.message : "Não foi possível carregar os indicadores.",
        });
      });

    return () => {
      mounted = false;
    };
  }, [sessionKey, revisao]);

  const porStatus = dados?.solicitacoes.meta.porStatus;
  const aguardando = porStatus?.PENDENTE ?? 0;
  const recentes = dados?.solicitacoes.data.slice(0, 6) ?? [];

  const alertasOperacionais = dados?.alertasOperacionais;

  const indicadores = [
    {
      label: "Veículos ativos",
      value: dados?.veiculos.total ?? 0,
      description: dados ? `${dados.veiculos.totalGeral} cadastrados no total` : "Carregando frota",
      icon: Car,
      tone: "emerald",
    },
    {
      label: "Viagens do dia",
      value: dados?.viagensDoDia ?? 0,
      description: "Aprovadas, em trânsito ou concluídas",
      icon: CalendarDays,
      tone: "blue",
    },
    {
      label: "Solicitações pendentes",
      value: aguardando,
      description: "Aguardando análise",
      icon: Clock3,
      tone: "amber",
    },
    {
      label: "Chamados SVO ativos",
      value: dados?.svo.chamadosAtivos ?? 0,
      description: "Em análise ou com coleta ativa",
      icon: Activity,
      tone: "blue",
    },
    {
      label: "SLA médio de resposta",
      value:
        dados?.svo.slaMedioRespostaMinutos == null
          ? "—"
          : `${slaFmt.format(dados.svo.slaMedioRespostaMinutos)} min`,
      description: "Tempo médio até a chegada local",
      icon: Timer,
      tone: "slate",
    },
    {
      label: "Solicitações registradas",
      value: dados?.solicitacoes.meta.total ?? 0,
      description: "Total no sistema",
      icon: ClipboardList,
      tone: "slate",
    },
  ] as const;

  const toneStyles = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="animate-in space-y-6 fade-in duration-200">
      <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 sm:text-sm">
            {todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {user?.nome ? `Olá, ${user.nome}!` : "Painel da frota"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Indicadores atualizados a partir dos registros do sistema.
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={atualizarDados}
          isLoading={isLoading}
        >
          Atualizar
        </Button>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {indicadores.map(({ label, value, description, icon: Icon, tone }) => (
          <Card
            key={label}
            className="flex min-h-36 flex-col justify-between rounded-3xl border border-slate-200/90 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </span>
                <p className="mt-1 text-xs font-medium text-slate-600">{description}</p>
              </div>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-2xl ${toneStyles[tone]}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
            </div>
            <span className="mt-4 text-3xl font-extrabold tabular-nums text-slate-900">
              {dados ? value : "—"}
            </span>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border border-slate-200/80 p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Frota por situação e categoria</h2>
          <p className="mt-1 text-xs text-slate-500">
            Contagens atuais separadas entre frota administrativa e SVO.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["ADMINISTRATIVA", "SVO"] as const).map((tipo) => {
            const frota = dados?.veiculos.porTipoFrota[tipo];
            return (
              <section key={tipo} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-slate-800">{TIPO_FROTA_LABEL[tipo]}</h3>
                  <span className="text-xs text-slate-500">
                    {dados ? `${frota?.total ?? 0} ativos` : "—"}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {STATUS_VEICULO.filter(
                    (status) => tipo === "SVO" || status !== "DESINFECCAO",
                  ).map((status) => (
                    <div key={status} className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-slate-600">{STATUS_VEICULO_LABEL[status]}</dt>
                      <dd className="font-bold tabular-nums text-slate-900">
                        {dados ? (frota?.porStatus[status] ?? 0) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-3xl border border-slate-200/80 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-900">
          <TriangleAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
          Alertas operacionais
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          CNHs vencidas ou próximas do vencimento e documentos veiculares com vencimento em até 30 dias.
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Carregando alertas...</p>
        ) : errorMessage ? (
          <p className="text-sm text-slate-500">Não foi possível carregar os alertas.</p>
        ) : alertasOperacionais && alertasOperacionais.total > 0 ? (
          <div className="space-y-5">
            {alertasOperacionais.cnh.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-bold text-slate-800">CNHs</h3>
                <div className="space-y-2">
                  {alertasOperacionais.cnh.map((cnh) => (
                    <div
                      key={cnh.motoristaId}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-800">{cnh.nome}</span>
                      <Badge variant={cnh.situacao === "VENCIDO" ? "danger" : "warning"}>
                        {cnh.situacao === "VENCIDO" ? "CNH vencida" : "Vence em"} ·{" "}
                        {formatarData(cnh.dataVencimento)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {alertasOperacionais.documentos.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Documentos dos veículos</h3>
                <ListaAlertasDocumentos documentos={alertasOperacionais.documentos} />
              </section>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum alerta operacional ativo.</p>
        )}
      </Card>

      <Card className="overflow-hidden rounded-3xl border border-slate-200/80">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Solicitações recentes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {dados
                ? `${dados.solicitacoes.meta.total} registros reais ordenados pela data de criação.`
                : "Registros ordenados pela data de criação."}
            </p>
          </div>
          {porStatus && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span>{porStatus.APROVADA + porStatus.EM_TRANSITO} aprovadas ou em trânsito</span>
              <span aria-hidden="true">·</span>
              <span>{porStatus.RECUSADA} recusadas</span>
            </div>
          )}
        </div>
        {recentes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentes.map((solicitacao: SolicitacaoViagem) => (
              <div
                key={solicitacao.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold tracking-wide text-slate-800">
                      {solicitacao.protocolo}
                    </span>
                    <Badge variant={STATUS_SOLICITACAO_VARIANT[solicitacao.status]} dot size="sm">
                      {STATUS_SOLICITACAO_LABEL[solicitacao.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {solicitacao.origem || "Origem não informada"} →{" "}
                    {solicitacao.destino || "Destino não informado"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {solicitacao.solicitanteNome} ·{" "}
                    {solicitacao.setorOrigem || "Setor não informado"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatarDataHora(solicitacao.criadoEm)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-slate-500">
            {isLoading ? "Carregando solicitações..." : "Não há solicitações registradas."}
          </p>
        )}
      </Card>
    </div>
  );
};
