import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Car, ClipboardList, Clock3, RefreshCw } from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import {
  STATUS_SOLICITACAO_LABEL,
  STATUS_SOLICITACAO_VARIANT,
  type SolicitacaoViagem,
  type StatusSolicitacao,
} from "../../types/solicitacao";

type StatusVeiculo = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO" | "DESINFECCAO";

interface VeiculoResumo {
  id: string;
  status: StatusVeiculo;
}

interface SolicitacoesResponse {
  data: SolicitacaoViagem[];
  meta: {
    total: number;
    porStatus: Record<StatusSolicitacao, number>;
  };
}

interface DashboardData {
  veiculos: VeiculoResumo[];
  totalVeiculos: number;
  solicitacoes: SolicitacoesResponse;
}

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatarDataHora(valor?: string | null) {
  return valor ? dataHoraFmt.format(new Date(valor)) : "—";
}

export const DashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [today] = useState(() => new Date());
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [veiculos, solicitacoes] = await Promise.all([
        apiRequest<{ data: VeiculoResumo[]; meta: { total: number } }>(
          "/veiculos?page=1&pageSize=100",
          { token },
        ),
        apiRequest<SolicitacoesResponse>("/solicitacoes?page=1&pageSize=100", { token }),
      ]);
      setDados({
        veiculos: veiculos.data,
        totalVeiculos: veiculos.meta.total,
        solicitacoes,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível carregar os indicadores.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const porStatus = dados?.solicitacoes.meta.porStatus;
  const disponiveis =
    dados?.veiculos.filter((veiculo) => veiculo.status === "DISPONIVEL").length ?? 0;
  const emViagem = dados?.veiculos.filter((veiculo) => veiculo.status === "EM_VIAGEM").length ?? 0;
  const manutencao =
    dados?.veiculos.filter((veiculo) => veiculo.status === "MANUTENCAO").length ?? 0;
  const aguardando = porStatus?.PENDENTE ?? 0;
  const recentes = dados?.solicitacoes.data.slice(0, 6) ?? [];

  const indicadores = [
    {
      label: "Veículos cadastrados",
      value: dados?.totalVeiculos ?? 0,
      description: `${disponiveis} disponíveis`,
      icon: Car,
      tone: "emerald",
    },
    {
      label: "Em viagem",
      value: emViagem,
      description: "Veículos marcados em viagem",
      icon: Activity,
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
      label: "Solicitações registradas",
      value: dados?.solicitacoes.meta.total ?? 0,
      description: `${manutencao} veículo(s) em manutenção`,
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
          onClick={() => void carregarDados()}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card className="overflow-hidden rounded-3xl border border-slate-200/80">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Solicitações recentes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Registros reais ordenados pela data de criação.
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
