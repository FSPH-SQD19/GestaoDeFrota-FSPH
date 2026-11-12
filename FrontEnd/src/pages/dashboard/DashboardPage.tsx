import React, { useEffect, useMemo, useState } from "react";
import { useAtualizacaoAutomatica } from "../../lib/useAtualizacaoAutomatica";
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
import type { RelatorioPeriodo } from "../../types/relatorio";
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
  svo: {
    chamadosAtivos: number;
    slaMedioRespostaMinutos: number | null;
    slaMedioEntregaMinutos: number | null;
  };
  alertasOperacionais: AlertasOperacionais;
  relatorioMes?: RelatorioPeriodo | null;
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
const numeroFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatarDataHora(valor?: string | null) {
  return valor ? dataHoraFmt.format(new Date(valor)) : "—";
}

function formatarData(valor: string) {
  return dataFmt.format(new Date(`${valor}T00:00:00Z`));
}

function calcularPercentual(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 100);
}

/** 1. Gráfico de Rosca Ampliado (360°) + Grade 2x2 de Status da Frota */
function GraficoDistribuicaoFrota({
  segmentos,
  percentualDisponivel,
  totalVeiculos,
}: {
  segmentos: { label: string; valor: number; cor: string }[];
  percentualDisponivel: number;
  totalVeiculos: number;
}) {
  const raio = 64;
  const circunferencia = 2 * Math.PI * raio;
  const somaValores = segmentos.reduce((acc, item) => acc + item.valor, 0);

  const positivos = segmentos.filter((seg) => seg.valor > 0);
  const arcos = positivos.map((seg, indice) => {
    const fracao = somaValores > 0 ? seg.valor / somaValores : 0;
    const comprimento = fracao * circunferencia;
    const deslocamentoAnterior = positivos
      .slice(0, indice)
      .reduce(
        (acc, item) => acc + (somaValores > 0 ? (item.valor / somaValores) * circunferencia : 0),
        0,
      );
    return {
      ...seg,
      strokeDasharray: `${comprimento} ${circunferencia - comprimento}`,
      strokeDashoffset: -deslocamentoAnterior,
    };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex h-48 w-48 shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label="Gráfico de distribuição da frota por status"
        >
          <circle cx="80" cy="80" r={raio} fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
          {arcos.map((arco) => (
            <circle
              key={arco.label}
              cx="80"
              cy="80"
              r={raio}
              fill="transparent"
              stroke={arco.cor}
              strokeWidth="16"
              strokeDasharray={arco.strokeDasharray}
              strokeDashoffset={arco.strokeDashoffset}
              className="transition-all duration-300 ease-out"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-3xl font-bold leading-none tabular-nums text-slate-900">
            {totalVeiculos > 0 ? `${percentualDisponivel}%` : "0%"}
          </span>
          <span className="mt-1 text-xs font-medium text-slate-500">Disponível</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3">
        {segmentos.map((seg) => {
          const pct = calcularPercentual(seg.valor, totalVeiculos);
          return (
            <div key={seg.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-xs"
                    style={{ backgroundColor: seg.cor }}
                  />
                  <span className="break-words font-medium leading-tight text-slate-700">
                    {seg.label}
                  </span>
                </div>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {`${seg.valor} veíc.`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${totalVeiculos > 0 ? Math.max(pct, seg.valor > 0 ? 6 : 0) : 0}%`,
                    backgroundColor: seg.cor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 2. Gráfico de Colunas Verticais para Solicitações por Status */
function GraficoBarrasSolicitacoes({
  colunas,
  totalSolicitacoes,
}: {
  colunas: { label: string; valor: number; corHex: string }[];
  totalSolicitacoes: number;
}) {
  const maiorValor = Math.max(...colunas.map((c) => c.valor), 1);

  return (
    <div className="flex h-full flex-col justify-between space-y-4 pt-2">
      <div className="relative h-48 w-full px-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-5 bottom-0 flex flex-col justify-between"
        >
          <div className="border-b border-dashed border-slate-200" />
          <div className="border-b border-dashed border-slate-200/80" />
          <div className="border-b border-dashed border-slate-200/80" />
          <div className="border-b border-slate-300" />
        </div>

        <div className="relative z-10 grid h-full grid-cols-6 items-end gap-1 sm:gap-2">
          {colunas.map((col) => {
            const pctTotal = calcularPercentual(col.valor, totalSolicitacoes);
            const alturaRelativa =
              col.valor > 0 ? Math.max(Math.round((col.valor / maiorValor) * 100), 10) : 3;

            return (
              <div key={col.label} className="flex h-full flex-col items-center justify-end">
                <span className="mb-1.5 font-mono text-[11px] font-semibold tabular-nums text-slate-700">
                  {`${pctTotal}%`}
                </span>
                <div className="flex h-[148px] w-full max-w-[38px] items-end justify-center rounded-t-md bg-slate-100/80 px-1 pt-1">
                  <div
                    className="w-full rounded-t-xs transition-all duration-300 ease-out"
                    style={{
                      height: `${alturaRelativa}%`,
                      backgroundColor: col.corHex,
                    }}
                    title={`${col.label}: ${col.valor} (${pctTotal}%)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 border-t border-slate-100 pt-3 text-center">
        {colunas.map((col) => (
          <div key={col.label} className="flex flex-col items-center">
            <div className="flex min-h-8 flex-col items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-xs"
                style={{ backgroundColor: col.corHex }}
              />
              <span className="max-w-full break-words text-[10px] font-semibold leading-tight text-slate-700">
                {col.label}
              </span>
            </div>
            <span className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-900">
              {`${col.valor} sol.`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 3. Gráfico de Quilometragem e Consumo de Combustível no Mês */
function GraficoConsumoQuilometragemMes({
  relatorioMes,
}: {
  relatorioMes?: RelatorioPeriodo | null;
}) {
  const veiculosMes = relatorioMes?.veiculos ?? [];
  const kmTotal = relatorioMes?.kmRodados ?? 0;
  const litrosTotal = relatorioMes?.consumoEstimadoLitros ?? 0;
  const rendimentoMedio = litrosTotal > 0 && kmTotal > 0 ? kmTotal / litrosTotal : null;

  const litrosAdm = veiculosMes
    .filter((v) => !v.destaque)
    .reduce((acc, v) => acc + v.consumoLitros, 0);
  const litrosSvo = veiculosMes
    .filter((v) => v.destaque)
    .reduce((acc, v) => acc + v.consumoLitros, 0);

  const pctLitrosAdm = calcularPercentual(litrosAdm, litrosTotal);
  const pctLitrosSvo = calcularPercentual(litrosSvo, litrosTotal);

  const topVeiculos = [...veiculosMes]
    .filter((v) => v.kmRodados > 0)
    .sort((a, b) => b.kmRodados - a.kmRodados)
    .slice(0, 4);
  const maiorKmVeiculo = Math.max(...topVeiculos.map((v) => v.kmRodados), 1);
  const maiorLitroVeiculo = Math.max(...topVeiculos.map((v) => v.consumoLitros), 1);

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Abastecimento por frota (L)</span>
          <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
            {rendimentoMedio !== null
              ? `Estimativa: ${numeroFmt.format(rendimentoMedio)} km/L`
              : `${numeroFmt.format(litrosTotal)} L abastecidos`}
          </span>
        </div>
        <p className="text-[11px] text-slate-600">
          Estimativa: quilômetros de viagens administrativas concluídas divididos pelos litros
          abastecidos em ambas as frotas no período; não representa consumo medido.
        </p>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
          {litrosTotal > 0 ? (
            <>
              <div
                className="h-full bg-slate-900 transition-all duration-300"
                style={{ width: `${pctLitrosAdm}%` }}
                title={`Frota Administrativa: ${numeroFmt.format(litrosAdm)} L`}
              />
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${pctLitrosSvo}%` }}
                title={`Frota SVO: ${numeroFmt.format(litrosSvo)} L`}
              />
            </>
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-slate-900" />
            Adm:{" "}
            <strong className="font-mono text-slate-800">{`${numeroFmt.format(litrosAdm)} L`}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-blue-600" />
            SVO:{" "}
            <strong className="font-mono text-slate-800">{`${numeroFmt.format(litrosSvo)} L`}</strong>
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Veículos com maior rodagem no mês</span>
          <span>Rodagem / Combustível</span>
        </div>

        {topVeiculos.length > 0 ? (
          <div className="space-y-2.5">
            {topVeiculos.map((v) => {
              const pctKm =
                v.kmRodados > 0 ? Math.max(Math.round((v.kmRodados / maiorKmVeiculo) * 100), 8) : 0;
              const pctLitros =
                v.consumoLitros > 0
                  ? Math.max(Math.round((v.consumoLitros / maiorLitroVeiculo) * 100), 8)
                  : 0;

              return (
                <div key={v.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">{v.codigo}</span>
                      <span className="truncate text-[11px] text-slate-500">{v.descricao}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                      {`${numeroFmt.format(v.kmRodados)} km · ${numeroFmt.format(v.consumoLitros)} L`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all duration-300"
                        style={{ width: `${pctKm}%` }}
                      />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-600 transition-all duration-300"
                        style={{ width: `${pctLitros}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-xs text-slate-500">
            Sem quilometragem de viagens concluídas neste mês.
          </div>
        )}
      </div>
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const revisaoAutomatica = useAtualizacaoAutomatica();
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
  }, [sessionKey, revisao, revisaoAutomatica]);

  const porStatus = dados?.solicitacoes.meta.porStatus;
  const totalVeiculos = dados?.veiculos.total ?? 0;
  const disponiveis = dados?.veiculos.porStatus.DISPONIVEL ?? 0;
  const emViagem = dados?.veiculos.porStatus.EM_VIAGEM ?? 0;
  const manutencao = dados?.veiculos.porStatus.MANUTENCAO ?? 0;
  const desinfeccao = dados?.veiculos.porStatus.DESINFECCAO ?? 0;

  const totalSolicitacoes = dados?.solicitacoes.meta.total ?? 0;
  const aguardando = porStatus?.PENDENTE ?? 0;
  const aprovadas = porStatus?.APROVADA ?? 0;
  const emTransito = porStatus?.EM_TRANSITO ?? 0;
  const concluidas = porStatus?.CONCLUIDA ?? 0;
  const recusadas = porStatus?.RECUSADA ?? 0;
  const canceladas = porStatus?.CANCELADA ?? 0;
  const recentes = dados?.solicitacoes.data.slice(0, 6) ?? [];

  const alertasOperacionais = dados?.alertasOperacionais;

  const taxaDisponibilidade = calcularPercentual(disponiveis, totalVeiculos);

  const segmentosFrota = [
    { label: "Disponíveis", valor: disponiveis, cor: "#047857" },
    { label: "Em viagem", valor: emViagem, cor: "#1d4ed8" },
    { label: "Manutenção", valor: manutencao, cor: "#b45309" },
    { label: "Desinfecção SVO", valor: desinfeccao, cor: "#be123c" },
  ];

  const colunasSolicitacoes = [
    { label: "Pendentes", valor: aguardando, corHex: "#b45309" },
    { label: "Aprovadas", valor: aprovadas, corHex: "#334155" },
    { label: "Em trânsito", valor: emTransito, corHex: "#1d4ed8" },
    { label: "Concluídas", valor: concluidas, corHex: "#047857" },
    { label: "Recusadas", valor: recusadas, corHex: "#be123c" },
    { label: "Canceladas", valor: canceladas, corHex: "#6b7280" },
  ];

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
      description: "Chamado → chegada ao local",
      icon: Timer,
      tone: "slate",
    },
    {
      label: "SLA médio de entrega",
      value:
        dados?.svo.slaMedioEntregaMinutos == null
          ? "—"
          : `${slaFmt.format(dados.svo.slaMedioEntregaMinutos)} min`,
      description: "Chamado → entrega no SVO",
      icon: Clock3,
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

      {/* Indicadores Rápidos / KPIs Compactos */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {indicadores.map(({ label, value, description, icon: Icon, tone }) => (
          <Card
            key={label}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs transition-all hover:border-slate-300"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {label}
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
              >
                <Icon className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-1">
              <span className="text-xl font-extrabold tabular-nums text-slate-900 xl:text-2xl">
                {dados ? value : "—"}
              </span>
            </div>
            <p
              className="mt-0.5 truncate text-[11px] font-medium text-slate-500"
              title={description}
            >
              {description}
            </p>
          </Card>
        ))}
      </div>

      {/* Painéis Gráficos Analíticos (Status da Frota + Solicitações por Status + Consumo/Rodagem no Mês) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="flex flex-col justify-between p-5 lg:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Status da frota</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {dados ? (
                  <>
                    <span className="font-medium text-emerald-700">{`${disponiveis} disponíveis`}</span>{" "}
                    · <span>{`${manutencao} veículo(s) em manutenção`}</span>
                  </>
                ) : (
                  "Aguardando dados da frota"
                )}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
              {dados ? `${totalVeiculos} ativos` : "—"}
            </span>
          </div>

          {dados ? (
            <GraficoDistribuicaoFrota
              segmentos={segmentosFrota}
              percentualDisponivel={taxaDisponibilidade}
              totalVeiculos={totalVeiculos}
            />
          ) : (
            <p className="text-sm text-slate-500">
              {isLoading ? "Carregando dados…" : "Dados indisponíveis."}
            </p>
          )}
        </Card>

        <Card className="flex flex-col justify-between p-5 lg:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Solicitações por status</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {porStatus
                  ? `${porStatus.APROVADA + porStatus.EM_TRANSITO} aprovadas/em trânsito`
                  : "Etapas de atendimento"}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
              {dados ? `${totalSolicitacoes} total` : "—"}
            </span>
          </div>

          {dados ? (
            <GraficoBarrasSolicitacoes
              colunas={colunasSolicitacoes}
              totalSolicitacoes={totalSolicitacoes}
            />
          ) : (
            <p className="text-sm text-slate-500">
              {isLoading ? "Carregando dados…" : "Dados indisponíveis."}
            </p>
          )}
        </Card>

        <Card className="flex flex-col justify-between p-5 lg:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Consumo e rodagem (mês)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Quilometragem e litros abastecidos por frota
              </p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
              {dados?.relatorioMes ? `${numeroFmt.format(dados.relatorioMes.kmRodados)} km` : "—"}
            </span>
          </div>

          {dados?.relatorioMes ? (
            <GraficoConsumoQuilometragemMes relatorioMes={dados.relatorioMes} />
          ) : (
            <p className="text-sm text-slate-500">
              {isLoading ? "Carregando dados…" : "Dados indisponíveis."}
            </p>
          )}
        </Card>
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
          CNHs vencidas ou próximas do vencimento e documentos veiculares com vencimento em até 30
          dias.
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
