import React, { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Fuel,
  Gauge,
  Printer,
  Route,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { Badge, Button, Card, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import type {
  FormatoExportacaoRelatorio,
  ItemRelatorioConsumo,
  ItemRelatorioManutencao,
  ItemRelatorioViagemSetor,
  RelatorioPeriodo,
  RelatorioVeiculo,
  RespostaRelatorioAgregado,
  TipoRelatorioAgregado,
} from "../../types/relatorio";
import { apiRequest } from "../../lib/api";
import { gerarCsv } from "../../lib/relatorioCsv";

type VisaoGrafico = "consolidado" | "veiculo" | "motorista";
type AbaRelatorio = "operacional" | TipoRelatorioAgregado;

const VISOES: { id: VisaoGrafico; label: string }[] = [
  { id: "consolidado", label: "Consolidado" },
  { id: "veiculo", label: "Veículo" },
  { id: "motorista", label: "Motorista" },
];

const ABAS_RELATORIO: { id: AbaRelatorio; label: string; descricao: string }[] = [
  {
    id: "operacional",
    label: "Detalhamento por veículo",
    descricao: "Quilometragem registrada e abastecimentos por veículo",
  },
  {
    id: "consumo",
    label: "Consumo médio (km/L)",
    descricao: "Eficiência estimada por veículo (km de viagens encerradas / litros abastecidos)",
  },
  {
    id: "manutencoes",
    label: "Manutenções",
    descricao: "Quantidade e custos consolidados por tipo e status de manutenção",
  },
  {
    id: "viagens",
    label: "Viagens por setor",
    descricao: "Volume de solicitações e despachos agrupados por setor de origem e status",
  },
];

const CORES = ["#2563eb", "#4f46e5", "#64748b", "#0f172a", "#93c5fd"];

const numero = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type IntervaloRelatorio = { inicio: string; fim: string };

function intervaloInicial(): IntervaloRelatorio {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01`, fim: `${mes}-${String(hoje.getDate()).padStart(2, "0")}` };
}

function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function rotuloIntervalo({ inicio, fim }: IntervaloRelatorio): string {
  const dataInicio = dataLocal(inicio);
  const dataFim = dataLocal(fim);
  const mesmoMes =
    dataInicio.getMonth() === dataFim.getMonth() &&
    dataInicio.getFullYear() === dataFim.getFullYear();

  if (mesmoMes) {
    const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" })
      .format(dataInicio)
      .replace(".", "");
    const diaInicio = String(dataInicio.getDate()).padStart(2, "0");
    const diaFim = String(dataFim.getDate()).padStart(2, "0");
    return `${diaInicio}-${diaFim} ${mes} ${dataInicio.getFullYear()}`;
  }

  const curto = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${curto.format(dataInicio).replace(".", "")} – ${curto.format(dataFim).replace(".", "")}`;
}

function formatarDataAtual(data: Date): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function salvarBlobComoArquivo(blob: Blob, nomeArquivo: string) {
  if (typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function exportarCsv(periodo: RelatorioPeriodo) {
  const csv = gerarCsv(periodo);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  salvarBlobComoArquivo(blob, `relatorio-frota-${periodo.id}.csv`);
}

function imprimirRelatorioPdf() {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
}

const ROTULO_STATUS_VIAGEM: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "danger" | "neutral" }
> = {
  PENDENTE: { label: "Pendente", variant: "warning" },
  APROVADA: { label: "Aprovada", variant: "info" },
  EM_TRANSITO: { label: "Em trânsito", variant: "info" },
  CONCLUIDA: { label: "Concluída", variant: "success" },
  RECUSADA: { label: "Recusada", variant: "danger" },
  CANCELADA: { label: "Cancelada", variant: "neutral" },
};

const ROTULO_TIPO_MANUTENCAO: Record<string, string> = {
  PREVENTIVA: "Preventiva",
  CORRETIVA: "Corretiva",
};

const ROTULO_STATUS_MANUTENCAO: Record<
  string,
  { label: string; variant: "success" | "warning" | "info" | "neutral" }
> = {
  CONCLUIDA: { label: "Concluída", variant: "success" },
  ABERTA: { label: "Aberta", variant: "warning" },
  EM_ANDAMENTO: { label: "Em andamento", variant: "info" },
};

const colunasOperacional: Column<RelatorioVeiculo>[] = [
  {
    header: "Veículo",
    render: (veiculo) => (
      <div>
        <p className="font-mono font-bold text-slate-900">{veiculo.codigo}</p>
        <p className="text-xs text-slate-500">{veiculo.descricao}</p>
      </div>
    ),
  },
  {
    header: "Viagens/Coletas",
    render: (veiculo) => (
      <span className="tabular-nums">
        <span className="font-semibold text-slate-900">{veiculo.operacoes}</span>{" "}
        <span className="text-slate-500">{veiculo.unidade}</span>
      </span>
    ),
  },
  {
    header: "Km rodados",
    render: (veiculo) => <span className="tabular-nums">{numero.format(veiculo.kmRodados)}</span>,
  },
  {
    header: "Km médio / Viagem",
    render: (veiculo) => (
      <span className="tabular-nums">
        {veiculo.kmMedio === null ? "—" : decimal.format(veiculo.kmMedio)}
      </span>
    ),
  },
  {
    header: "Consumo total (L)",
    render: (veiculo) => (
      <span className="tabular-nums">{numero.format(veiculo.consumoLitros)}</span>
    ),
  },
  {
    header: "Consumo médio / Viagem",
    render: (veiculo) => (
      <span className="tabular-nums">
        {veiculo.consumoMedio === null ? "—" : decimal.format(veiculo.consumoMedio)}
      </span>
    ),
  },
];

const colunasConsumo: Column<ItemRelatorioConsumo>[] = [
  {
    header: "Placa",
    render: (item) => <span className="font-mono font-bold text-slate-900">{item.placa}</span>,
  },
  {
    header: "Modelo",
    render: (item) => <span className="font-medium text-slate-700">{item.modelo}</span>,
  },
  {
    header: "Km rodados",
    render: (item) => <span className="tabular-nums">{numero.format(item.kmRodados)} km</span>,
  },
  {
    header: "Litros abastecidos",
    render: (item) => (
      <span className="tabular-nums">{decimal.format(item.litrosAbastecidos)} L</span>
    ),
  },
  {
    header: "Consumo médio (km/L)",
    render: (item) =>
      item.consumoMedioKmL === null ? (
        <span className="text-slate-400">Indisponível</span>
      ) : (
        <span className="font-semibold text-emerald-700 tabular-nums">
          {decimal.format(item.consumoMedioKmL)} km/L
        </span>
      ),
  },
];

const colunasManutencao: Column<ItemRelatorioManutencao>[] = [
  {
    header: "Tipo de manutenção",
    render: (item) => (
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
        <Wrench className="h-3.5 w-3.5 text-slate-400" />
        {ROTULO_TIPO_MANUTENCAO[item.tipo] ?? item.tipo}
      </span>
    ),
  },
  {
    header: "Status",
    render: (item) => {
      const info = ROTULO_STATUS_MANUTENCAO[item.status] ?? {
        label: item.status,
        variant: "neutral" as const,
      };
      return (
        <Badge variant={info.variant} size="sm" dot>
          {info.label}
        </Badge>
      );
    },
  },
  {
    header: "Quantidade",
    render: (item) => (
      <span className="font-semibold text-slate-900 tabular-nums">
        {numero.format(item.quantidade)}
      </span>
    ),
  },
  {
    header: "Custo total",
    render: (item) => (
      <span className="font-semibold text-slate-900 tabular-nums">
        {moeda.format(item.custoTotal)}
      </span>
    ),
  },
];

const colunasViagensSetor: Column<ItemRelatorioViagemSetor>[] = [
  {
    header: "Setor de origem",
    render: (item) => (
      <span className="font-semibold text-slate-900">{item.setor ?? "Não informado"}</span>
    ),
  },
  {
    header: "Status da solicitação",
    render: (item) => {
      const info = ROTULO_STATUS_VIAGEM[item.status] ?? {
        label: item.status,
        variant: "neutral" as const,
      };
      return (
        <Badge variant={info.variant} size="sm" dot>
          {info.label}
        </Badge>
      );
    },
  },
  {
    header: "Viagens no período",
    render: (item) => (
      <span className="font-bold text-slate-900 tabular-nums">{numero.format(item.viagens)}</span>
    ),
  },
];

type DadosAgregados = {
  consumo: ItemRelatorioConsumo[];
  manutencoes: ItemRelatorioManutencao[];
  viagens: ItemRelatorioViagemSetor[];
};

export const RelatoriosPage: React.FC = () => {
  const { user, sessionKey } = useAuth();
  const [hoje] = useState(() => new Date());
  const [intervalo, setIntervalo] = useState<IntervaloRelatorio>(intervaloInicial);
  const [visao, setVisao] = useState<VisaoGrafico>("consolidado");
  const [abaRelatorio, setAbaRelatorio] = useState<AbaRelatorio>("operacional");
  const [rascunhoSetor, setRascunhoSetor] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [exportandoFormato, setExportandoFormato] = useState<FormatoExportacaoRelatorio | null>(
    null,
  );
  const [erroExportacao, setErroExportacao] = useState("");

  const [resposta, setResposta] = useState<{
    chave: string;
    dados: RelatorioPeriodo | null;
    erro: string;
  } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const chave = `${intervalo.inicio}_${intervalo.fim}_${sessionKey}_${tentativa}`;
  const periodo = resposta?.chave === chave ? resposta.dados : null;
  const erro = resposta?.chave === chave ? resposta.erro : "";

  const [respostaAgregada, setRespostaAgregada] = useState<{
    chave: string;
    dados: DadosAgregados;
    erro: string;
  } | null>(null);
  const [tentativaAgregada, setTentativaAgregada] = useState(0);

  const tipoAgregadoAtivo: TipoRelatorioAgregado | null =
    abaRelatorio === "operacional" ? null : abaRelatorio;
  const chaveAgregada = tipoAgregadoAtivo
    ? `${tipoAgregadoAtivo}_${intervalo.inicio}_${intervalo.fim}_${tipoAgregadoAtivo === "viagens" ? setorFiltro : ""}_${sessionKey}_${tentativaAgregada}`
    : "";
  const carregandoAgregado =
    tipoAgregadoAtivo !== null && respostaAgregada?.chave !== chaveAgregada;
  const erroAgregado =
    tipoAgregadoAtivo !== null && respostaAgregada?.chave === chaveAgregada
      ? respostaAgregada.erro
      : "";

  useEffect(() => {
    let ativo = true;
    void apiRequest<RelatorioPeriodo>(
      `/relatorios?inicio=${intervalo.inicio}&fim=${intervalo.fim}`,
      {},
    )
      .then((dados) => {
        if (ativo) setResposta({ chave, dados, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativo)
          setResposta({
            chave,
            dados: null,
            erro: error instanceof Error ? error.message : "Não foi possível carregar o relatório.",
          });
      });
    return () => {
      ativo = false;
    };
  }, [intervalo.inicio, intervalo.fim, sessionKey, chave]);

  useEffect(() => {
    if (!tipoAgregadoAtivo) return;
    let ativo = true;
    const params = new URLSearchParams({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
    });
    if (tipoAgregadoAtivo === "viagens" && setorFiltro.trim()) {
      params.set("setor", setorFiltro.trim());
    }

    void apiRequest<RespostaRelatorioAgregado<unknown>>(
      `/relatorios/${tipoAgregadoAtivo}?${params.toString()}`,
      {},
    )
      .then((res) => {
        if (!ativo) return;
        const lista = Array.isArray(res?.dados) ? res.dados : [];
        setRespostaAgregada({
          chave: chaveAgregada,
          dados: {
            consumo: tipoAgregadoAtivo === "consumo" ? (lista as ItemRelatorioConsumo[]) : [],
            manutencoes:
              tipoAgregadoAtivo === "manutencoes" ? (lista as ItemRelatorioManutencao[]) : [],
            viagens: tipoAgregadoAtivo === "viagens" ? (lista as ItemRelatorioViagemSetor[]) : [],
          },
          erro: "",
        });
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setRespostaAgregada({
          chave: chaveAgregada,
          dados: { consumo: [], manutencoes: [], viagens: [] },
          erro:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os dados agregados.",
        });
      });

    return () => {
      ativo = false;
    };
  }, [tipoAgregadoAtivo, intervalo.inicio, intervalo.fim, setorFiltro, sessionKey, chaveAgregada]);

  async function exportarRelatorioAgregado(
    tipo: TipoRelatorioAgregado,
    formato: FormatoExportacaoRelatorio,
  ) {
    setErroExportacao("");
    setExportandoFormato(formato);
    try {
      const params = new URLSearchParams({
        inicio: intervalo.inicio,
        fim: intervalo.fim,
        formato,
      });
      if (tipo === "viagens" && setorFiltro.trim()) {
        params.set("setor", setorFiltro.trim());
      }
      const conteudo = await apiRequest<Blob | ArrayBuffer | string>(
        `/relatorios/${tipo}?${params.toString()}`,
        { responseType: "blob" },
      );
      const mimeType = formato === "pdf" ? "application/pdf" : "text/csv;charset=utf-8";
      const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mimeType });
      salvarBlobComoArquivo(blob, `${tipo}_${intervalo.inicio}_${intervalo.fim}.${formato}`);
    } catch (error: unknown) {
      setErroExportacao(
        error instanceof Error
          ? error.message
          : `Não foi possível exportar o arquivo ${formato.toUpperCase()}.`,
      );
    } finally {
      setExportandoFormato(null);
    }
  }

  const primeiroNome = user?.nome?.split(" ")[0] || "Gestor";
  const abaAtualInfo = ABAS_RELATORIO.find((item) => item.id === abaRelatorio) ?? ABAS_RELATORIO[0];
  const dadosAgregadosAtuais =
    respostaAgregada?.chave === chaveAgregada ? respostaAgregada.dados : null;

  const totalCustoManutencao = (dadosAgregadosAtuais?.manutencoes ?? []).reduce(
    (soma, item) => soma + item.custoTotal,
    0,
  );
  const totalOcorrenciasManutencao = (dadosAgregadosAtuais?.manutencoes ?? []).reduce(
    (soma, item) => soma + item.quantidade,
    0,
  );
  const totalViagensSetor = (dadosAgregadosAtuais?.viagens ?? []).reduce(
    (soma, item) => soma + item.viagens,
    0,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm 12mm;
          }
          aside, header, nav {
            display: none !important;
          }
          body, main, #root, #root > div, #root > div > div {
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Visão de tela interativa (oculta ao gerar o documento de relatório PDF) */}
      <div className="space-y-6 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
              {formatarDataAtual(hoje)}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
              Olá, {primeiroNome}!
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SeletorPeriodo intervalo={intervalo} onChange={setIntervalo} />
            <Button
              variant="outline"
              size="sm"
              onClick={imprimirRelatorioPdf}
              disabled={!periodo}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Imprimir PDF
            </Button>
          </div>
        </div>

        {erro ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
          >
            <p>{erro}</p>
            <Button variant="outline" onClick={() => setTentativa((valor) => valor + 1)}>
              Tentar novamente
            </Button>
          </div>
        ) : !periodo ? (
          <p role="status">Carregando relatório...</p>
        ) : null}
        {periodo && (
          <>
            <p className="text-xs text-slate-500">
              Quilometragem de viagens encerradas com odômetros válidos; litros abastecidos no
              período. Coletas SVO não possuem registro de quilometragem. Consumo por viagem e
              desvios de rota ainda não são registrados.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5">
              <Indicador
                rotulo="Km rodados"
                detalhe="No período selecionado"
                valor={numero.format(periodo.kmRodados)}
                nota="Odômetros válidos de viagens encerradas"
                tom="info"
                icone={<Gauge className="h-4.5 w-4.5 stroke-2" />}
              />
              <Indicador
                rotulo="Litros abastecidos"
                detalhe="Registros no período"
                valor={`${numero.format(periodo.consumoEstimadoLitros)}L`}
                nota="Abastecimento consolidado"
                tom="warning"
                icone={<Fuel className="h-4.5 w-4.5 stroke-2" />}
              />
              <Indicador
                rotulo="Viagens concluídas"
                detalhe="Despachos encerrados"
                valor={numero.format(periodo.viagensConcluidas)}
                nota={`${periodo.viagensEmAberto} em aberto`}
                tom="success"
                icone={<CheckCircle2 className="h-4.5 w-4.5 stroke-2" />}
              />
              <Indicador
                rotulo="Desvios de rota"
                detalhe="Fora do trajeto previsto"
                valor={periodo.desviosDeRota === null ? "—" : numero.format(periodo.desviosDeRota)}
                nota="Registro ainda indisponível"
                tom="danger"
                icone={<Route className="h-4.5 w-4.5 stroke-2" />}
              />
            </div>

            <GraficoRelatorio visao={visao} onChange={setVisao} periodo={periodo} />

            <Card className="rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
              <div className="mb-4 flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div
                  role="tablist"
                  aria-label="Categorias de relatório"
                  className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/60 bg-slate-100/90 p-1"
                >
                  {ABAS_RELATORIO.map((aba) => (
                    <button
                      key={aba.id}
                      type="button"
                      role="tab"
                      aria-selected={abaRelatorio === aba.id}
                      onClick={() => {
                        setErroExportacao("");
                        setAbaRelatorio(aba.id);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        abaRelatorio === aba.id
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {aba.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {abaRelatorio === "operacional" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportarCsv(periodo)}
                        disabled={periodo.veiculos.length === 0}
                        leftIcon={<Download className="h-4 w-4" />}
                      >
                        Exportar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void exportarRelatorioAgregado("consumo", "pdf")}
                        disabled={exportandoFormato !== null}
                        leftIcon={<FileText className="h-4 w-4" />}
                      >
                        {exportandoFormato === "pdf" ? "Gerando PDF..." : "Exportar PDF"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void exportarRelatorioAgregado(abaRelatorio, "csv")}
                        disabled={exportandoFormato !== null}
                        leftIcon={<FileSpreadsheet className="h-4 w-4" />}
                      >
                        {exportandoFormato === "csv" ? "Exportando CSV..." : "Exportar CSV"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void exportarRelatorioAgregado(abaRelatorio, "pdf")}
                        disabled={exportandoFormato !== null}
                        leftIcon={<FileText className="h-4 w-4" />}
                      >
                        {exportandoFormato === "pdf" ? "Gerando PDF..." : "Exportar PDF"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{abaAtualInfo.label}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{abaAtualInfo.descricao}</p>
                </div>

                {abaRelatorio === "viagens" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setSetorFiltro(rascunhoSetor.trim());
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <label className="relative flex items-center">
                      <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        aria-label="Filtrar por setor"
                        placeholder="Filtrar setor (ex: Laboratório)"
                        value={rascunhoSetor}
                        onChange={(event) => setRascunhoSetor(event.target.value)}
                        className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      />
                    </label>
                    <Button type="submit" variant="outline" size="sm">
                      Filtrar setor
                    </Button>
                    {setorFiltro && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRascunhoSetor("");
                          setSetorFiltro("");
                        }}
                        leftIcon={<X className="h-3.5 w-3.5" />}
                      >
                        Limpar
                      </Button>
                    )}
                  </form>
                )}
              </div>

              {erroExportacao && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
                >
                  {erroExportacao}
                </div>
              )}

              {abaRelatorio === "operacional" &&
                (periodo.veiculos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Nenhum veículo no período selecionado.
                  </p>
                ) : (
                  <Table
                    columns={colunasOperacional}
                    data={periodo.veiculos}
                    keyExtractor={(veiculo) => veiculo.id}
                    emptyMessage="Nenhum veículo no período selecionado."
                    className="border-0 shadow-none rounded-none"
                  />
                ))}

              {abaRelatorio !== "operacional" && erroAgregado && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
                >
                  <p>{erroAgregado}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setTentativaAgregada((valor) => valor + 1)}
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}

              {abaRelatorio !== "operacional" && !erroAgregado && carregandoAgregado && (
                <p role="status" className="py-8 text-center text-sm text-slate-500">
                  Carregando dados agregados...
                </p>
              )}

              {abaRelatorio === "consumo" && !erroAgregado && !carregandoAgregado && (
                <Table
                  columns={colunasConsumo}
                  data={dadosAgregadosAtuais?.consumo ?? []}
                  keyExtractor={(item) => item.placa}
                  emptyMessage="Nenhum registro de consumo no período selecionado."
                  className="border-0 shadow-none rounded-none"
                />
              )}

              {abaRelatorio === "manutencoes" && !erroAgregado && !carregandoAgregado && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-600">
                    <span>
                      Ocorrências no período:{" "}
                      <strong className="text-slate-900 tabular-nums">
                        {numero.format(totalOcorrenciasManutencao)}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Custo total consolidado:{" "}
                      <strong className="text-slate-900 tabular-nums">
                        {moeda.format(totalCustoManutencao)}
                      </strong>
                    </span>
                  </div>
                  <Table
                    columns={colunasManutencao}
                    data={dadosAgregadosAtuais?.manutencoes ?? []}
                    keyExtractor={(item) => `${item.tipo}_${item.status}`}
                    emptyMessage="Nenhuma manutenção registrada no período selecionado."
                    className="border-0 shadow-none rounded-none"
                  />
                </div>
              )}

              {abaRelatorio === "viagens" && !erroAgregado && !carregandoAgregado && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-600">
                    <span>
                      Total de solicitações/viagens:{" "}
                      <strong className="text-slate-900 tabular-nums">
                        {numero.format(totalViagensSetor)}
                      </strong>
                    </span>
                    {setorFiltro && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>
                          Setor filtrado: <strong className="text-slate-900">{setorFiltro}</strong>
                        </span>
                      </>
                    )}
                  </div>
                  <Table
                    columns={colunasViagensSetor}
                    data={dadosAgregadosAtuais?.viagens ?? []}
                    keyExtractor={(item) => `${item.setor ?? "sem-setor"}_${item.status}`}
                    emptyMessage="Nenhuma viagem encontrada para os filtros selecionados."
                    className="border-0 shadow-none rounded-none"
                  />
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Documento Formal A4 para Impressão / Salvamento em PDF */}
      {periodo && (
        <DocumentoRelatorioOficialA4
          periodo={periodo}
          intervalo={intervalo}
          dataEmissao={hoje}
          responsavel={user?.nome || "Gestor de Frota FSPH"}
          abaAtiva={abaRelatorio}
          setorFiltro={setorFiltro}
          dadosAgregados={dadosAgregadosAtuais}
        />
      )}
    </div>
  );
};

function DocumentoRelatorioOficialA4({
  periodo,
  intervalo,
  dataEmissao,
  responsavel,
  abaAtiva,
  setorFiltro,
  dadosAgregados,
}: {
  periodo: RelatorioPeriodo;
  intervalo: IntervaloRelatorio;
  dataEmissao: Date;
  responsavel: string;
  abaAtiva: AbaRelatorio;
  setorFiltro: string;
  dadosAgregados: DadosAgregados | null;
}) {
  const kmAdm = periodo.veiculos
    .filter((veiculo) => !veiculo.destaque)
    .reduce((total, veiculo) => total + veiculo.kmRodados, 0);
  const kmSvo = periodo.veiculos
    .filter((veiculo) => veiculo.destaque)
    .reduce((total, veiculo) => total + veiculo.kmRodados, 0);
  const totalOperacoesVeiculos = periodo.veiculos.reduce((soma, v) => soma + v.operacoes, 0);
  const consumoMedioGeral =
    periodo.consumoEstimadoLitros > 0 && periodo.kmRodados > 0
      ? `${decimal.format(periodo.kmRodados / periodo.consumoEstimadoLitros)} km/L`
      : "—";

  const emissaoFormatada = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dataEmissao);

  return (
    <section
      aria-label="Documento oficial de relatório para impressão"
      className="hidden print:block text-slate-900 text-xs leading-relaxed"
    >
      {/* Cabeçalho Institucional */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Governo de Sergipe • Fundação de Saúde Parreiras Horta (FSPH)
            </p>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-950 mt-0.5">
              RELATÓRIO OPERACIONAL E GERENCIAL DE FROTA — SISTEMA ROTA
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Consolidado oficial de quilometragem, abastecimento, viagens e manutenção
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-700 shrink-0">
            <p>
              <strong>Período:</strong> {formatarDataCurta(intervalo.inicio)} a{" "}
              {formatarDataCurta(intervalo.fim)}
            </p>
            <p>
              <strong>Emissão:</strong> {emissaoFormatada}
            </p>
            <p>
              <strong>Emitido por:</strong> {responsavel}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Resumo Executivo do Período */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
          1. Resumo Executivo do Período
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Km Rodados Total</th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">
                Litros Abastecidos
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">
                Média Estimada (km/L)
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">
                Viagens Concluídas
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Viagens em Aberto</th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">
                Km Frota Adm. / SVO
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2.5 py-2 font-bold tabular-nums">
                {numero.format(periodo.kmRodados)} km
              </td>
              <td className="border border-slate-300 px-2.5 py-2 font-bold tabular-nums">
                {decimal.format(periodo.consumoEstimadoLitros)} L
              </td>
              <td className="border border-slate-300 px-2.5 py-2 font-bold tabular-nums">
                {consumoMedioGeral}
              </td>
              <td className="border border-slate-300 px-2.5 py-2 font-bold tabular-nums">
                {numero.format(periodo.viagensConcluidas)} despachos
              </td>
              <td className="border border-slate-300 px-2.5 py-2 tabular-nums">
                {numero.format(periodo.viagensEmAberto)}
              </td>
              <td className="border border-slate-300 px-2.5 py-2 tabular-nums">
                {numero.format(kmAdm)} km / {numero.format(kmSvo)} km
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Detalhamento Operacional por Veículo */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
          2. Detalhamento Operacional e Consumo por Veículo
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Placa</th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Modelo</th>
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Frota</th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Viagens
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Km Rodados
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Km Médio / Viagem
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Litros (L)
              </th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Eficiência (km/L)
              </th>
            </tr>
          </thead>
          <tbody>
            {periodo.veiculos.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-slate-300 px-2.5 py-3 text-center">
                  Nenhum veículo com movimentação registrada no período selecionado.
                </td>
              </tr>
            ) : (
              periodo.veiculos.map((veiculo) => {
                const kmL =
                  veiculo.consumoLitros > 0 && veiculo.kmMedio !== null
                    ? `${decimal.format(veiculo.kmRodados / veiculo.consumoLitros)} km/L`
                    : "—";
                return (
                  <tr key={veiculo.id}>
                    <td className="border border-slate-300 px-2.5 py-1.5 font-mono font-bold">
                      {veiculo.codigo}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">{veiculo.descricao}</td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {veiculo.destaque ? "SVO" : "Administrativa"}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {numero.format(veiculo.operacoes)}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {numero.format(veiculo.kmRodados)} km
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {veiculo.kmMedio === null ? "—" : `${decimal.format(veiculo.kmMedio)} km`}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {decimal.format(veiculo.consumoLitros)} L
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {kmL}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {periodo.veiculos.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="border border-slate-300 px-2.5 py-1.5">
                  TOTAL CONSOLIDADO ({periodo.veiculos.length} veículos)
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                  {numero.format(totalOperacoesVeiculos)}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                  {numero.format(periodo.kmRodados)} km
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">—</td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                  {decimal.format(periodo.consumoEstimadoLitros)} L
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                  {consumoMedioGeral}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 3. Viagens Concluídas por Motorista */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
          3. Produtividade por Motorista (Viagens Encerradas no Período)
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Motorista</th>
              <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                Viagens Concluídas
              </th>
            </tr>
          </thead>
          <tbody>
            {periodo.motoristas.length === 0 ? (
              <tr>
                <td colSpan={2} className="border border-slate-300 px-2.5 py-3 text-center">
                  Nenhuma viagem encerrada por motorista no período selecionado.
                </td>
              </tr>
            ) : (
              periodo.motoristas.map((motorista) => (
                <tr key={motorista.id}>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                    {motorista.nome}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold tabular-nums">
                    {numero.format(motorista.operacoes)} {motorista.unidade}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Seção adicional caso o usuário tenha aberto Manutenções ou Viagens por Setor */}
      {abaAtiva === "manutencoes" && dadosAgregados && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            4. Demonstrativo Consolidado de Manutenções
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Tipo</th>
                <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Status</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                  Quantidade
                </th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                  Custo Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dadosAgregados.manutencoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-300 px-2.5 py-3 text-center">
                    Nenhuma manutenção registrada no período.
                  </td>
                </tr>
              ) : (
                dadosAgregados.manutencoes.map((item) => (
                  <tr key={`${item.tipo}_${item.status}`}>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      Manutenção {ROTULO_TIPO_MANUTENCAO[item.tipo] ?? item.tipo}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {ROTULO_STATUS_MANUTENCAO[item.status]?.label ?? item.status}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {numero.format(item.quantidade)}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {moeda.format(item.custoTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {abaAtiva === "viagens" && dadosAgregados && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            4. Demonstrativo de Viagens por Setor {setorFiltro ? `(Setor: ${setorFiltro})` : ""}
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Setor de Origem</th>
                <th className="border border-slate-300 px-2.5 py-1.5 font-bold">Status</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right font-bold">
                  Viagens
                </th>
              </tr>
            </thead>
            <tbody>
              {dadosAgregados.viagens.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-slate-300 px-2.5 py-3 text-center">
                    Nenhuma viagem encontrada no período.
                  </td>
                </tr>
              ) : (
                dadosAgregados.viagens.map((item) => (
                  <tr key={`${item.setor ?? "sem-setor"}_${item.status}`}>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      Setor: {item.setor ?? "Não informado"}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {ROTULO_STATUS_VIAGEM[item.status]?.label ?? item.status}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                      {numero.format(item.viagens)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé de Conferência e Assinatura */}
      <div className="mt-10 pt-6 border-t border-slate-300 flex items-end justify-between text-[10px] text-slate-600">
        <div>
          <p className="font-semibold text-slate-800">
            ROTA — Sistema de Gestão de Frota e SVO (FSPH)
          </p>
          <p>
            Nota técnica: Quilometragem apurada a partir de viagens encerradas com odômetros
            válidos.
          </p>
        </div>
        <div className="w-64 border-t border-slate-400 pt-1.5 text-center">
          <p className="font-semibold text-slate-800">{responsavel}</p>
          <p>Responsável pela Conferência / Gestão de Frota</p>
        </div>
      </div>
    </section>
  );
}

function SeletorPeriodo({
  intervalo,
  onChange,
}: {
  intervalo: IntervaloRelatorio;
  onChange: (intervalo: IntervaloRelatorio) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(intervalo);

  function abrir() {
    setRascunho(intervalo);
    setAberto(true);
  }

  function aplicar() {
    if (!rascunho.inicio || !rascunho.fim) return;
    const inicio = rascunho.inicio <= rascunho.fim ? rascunho.inicio : rascunho.fim;
    const fim = rascunho.inicio <= rascunho.fim ? rascunho.fim : rascunho.inicio;
    onChange({ inicio, fim });
    setAberto(false);
  }

  return (
    <div className="relative self-start">
      <button
        type="button"
        onClick={() => (aberto ? setAberto(false) : abrir())}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:border-slate-300"
      >
        <Calendar className="h-4 w-4 text-slate-500" />
        <span>{rotuloIntervalo(intervalo)}</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Selecionar período"
          className="absolute left-0 z-20 mt-2 w-72 sm:left-auto sm:right-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Início
              <input
                type="date"
                value={rascunho.inicio}
                onChange={(event) =>
                  setRascunho((atual) => ({ ...atual, inicio: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Fim
              <input
                type="date"
                value={rascunho.fim}
                onChange={(event) =>
                  setRascunho((atual) => ({ ...atual, fim: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={aplicar}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const TONS = {
  info: "bg-blue-50 text-blue-600 border-blue-100/90",
  warning: "bg-amber-50 text-amber-600 border-amber-100/90",
  success: "bg-emerald-50 text-emerald-600 border-emerald-100/90",
  danger: "bg-rose-50 text-rose-600 border-rose-100/90",
};

function Indicador({
  rotulo,
  detalhe,
  valor,
  nota,
  tom,
  icone,
}: {
  rotulo: string;
  detalhe: string;
  valor: string;
  nota: string;
  tom: keyof typeof TONS;
  icone: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {rotulo}
          </span>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">{detalhe}</p>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-2xl border shadow-2xs ${TONS[tom]}`}
        >
          {icone}
        </div>
      </div>
      <div className="mt-5">
        <p className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums sm:text-4xl">
          {valor}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">{nota}</p>
      </div>
    </div>
  );
}

function GraficoRelatorio({
  visao,
  onChange,
  periodo,
}: {
  visao: VisaoGrafico;
  onChange: (visao: VisaoGrafico) => void;
  periodo: RelatorioPeriodo;
}) {
  const kmAdm = periodo.veiculos
    .filter((veiculo) => !veiculo.destaque)
    .reduce((total, veiculo) => total + veiculo.kmRodados, 0);
  const kmSvo = periodo.veiculos
    .filter((veiculo) => veiculo.destaque)
    .reduce((total, veiculo) => total + veiculo.kmRodados, 0);

  const titulo =
    visao === "consolidado"
      ? "Participação de km por frota"
      : visao === "veiculo"
        ? "Quilometragem por veículo"
        : "Viagens por motorista";
  const subtitulo =
    visao === "consolidado"
      ? "Quilometragem registrada por frota"
      : visao === "veiculo"
        ? "Quilometragem registrada por veículo"
        : "Viagens encerradas no período por motorista";

  const legenda =
    visao === "consolidado"
      ? [
          { cor: CORES[0], rotulo: "Administrativa", valor: `${numero.format(kmAdm)} km` },
          { cor: CORES[1], rotulo: "SVO", valor: `${numero.format(kmSvo)} km` },
        ]
      : visao === "veiculo"
        ? [...periodo.veiculos]
            .sort((a, b) => b.kmRodados - a.kmRodados)
            .map((veiculo, indice) => ({
              cor: veiculo.destaque ? CORES[1] : CORES[indice % CORES.length],
              rotulo: veiculo.codigo,
              valor: `${numero.format(veiculo.kmRodados)} km`,
            }))
        : periodo.motoristas.map((motorista, indice) => ({
            cor: CORES[indice % CORES.length],
            rotulo: motorista.nome,
            valor: `${motorista.operacoes} ${motorista.unidade}`,
          }));

  return (
    <Card className="flex flex-col justify-between rounded-3xl border border-slate-200/80 p-6 shadow-2xs">
      <div>
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-1.5 self-start rounded-2xl border border-slate-200/60 bg-slate-100/90 p-1 sm:self-auto">
            {VISOES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                  visao === item.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {visao === "consolidado" && (
            <Rosca
              fatias={[
                { rotulo: "Administrativa", valor: kmAdm, cor: CORES[0] },
                { rotulo: "SVO", valor: kmSvo, cor: CORES[1] },
              ]}
              centro={`${numero.format(periodo.kmRodados)} km`}
            />
          )}
          {visao === "veiculo" && <BarrasVeiculo periodo={periodo} />}
          {visao === "motorista" && (
            <Pizza
              fatias={periodo.motoristas.map((motorista, indice) => ({
                rotulo: motorista.nome,
                valor: motorista.operacoes,
                cor: CORES[indice % CORES.length],
              }))}
            />
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        {legenda.map((item) => (
          <div
            key={item.rotulo}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.cor }} />
            <span>{item.rotulo}</span>
            <span className="font-medium text-slate-400">{item.valor}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Rosca({
  fatias,
  centro,
}: {
  fatias: { rotulo: string; valor: number; cor: string }[];
  centro: string;
}) {
  const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
  if (total <= 0)
    return <p className="text-sm text-slate-500">Sem quilometragem registrada no período.</p>;
  const raio = 42;
  const circunferencia = 2 * Math.PI * raio;
  const arcos = fatias.map((fatia, indice) => {
    const anterior = fatias.slice(0, indice).reduce((soma, item) => soma + item.valor, 0);
    return {
      ...fatia,
      tamanho: (fatia.valor / total) * circunferencia,
      inicio: (anterior / total) * circunferencia,
    };
  });

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 120 120" className="h-52 w-52" role="img" aria-label={centro}>
        {arcos.map((fatia) => (
          <circle
            key={fatia.rotulo}
            cx="60"
            cy="60"
            r={raio}
            fill="none"
            stroke={fatia.cor}
            strokeWidth="16"
            strokeDasharray={`${fatia.tamanho} ${circunferencia - fatia.tamanho}`}
            strokeDashoffset={-fatia.inicio}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
          {centro.split(" ")[0]}
        </text>
        <text x="60" y="70" textAnchor="middle" className="fill-slate-500 text-[8px]">
          km
        </text>
      </svg>
    </div>
  );
}

function Pizza({ fatias }: { fatias: { rotulo: string; valor: number; cor: string }[] }) {
  const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
  if (total <= 0)
    return <p className="text-sm text-slate-500">Sem viagens por motorista no período.</p>;
  const unica = fatias.find((fatia) => fatia.valor === total);
  if (unica)
    return (
      <div className="flex justify-center">
        <svg
          viewBox="0 0 120 120"
          className="h-52 w-52"
          role="img"
          aria-label="Participação por motorista"
        >
          <circle cx="60" cy="60" r="46" fill={unica.cor} />
        </svg>
      </div>
    );
  const caminhos = fatias.map((fatia, indice) => {
    const anterior = fatias.slice(0, indice).reduce((soma, item) => soma + item.valor, 0);
    const inicio = -Math.PI / 2 + (anterior / total) * Math.PI * 2;
    const fim = inicio + (fatia.valor / total) * Math.PI * 2;
    const grande = fim - inicio > Math.PI ? 1 : 0;
    const x1 = 60 + 46 * Math.cos(inicio);
    const y1 = 60 + 46 * Math.sin(inicio);
    const x2 = 60 + 46 * Math.cos(fim);
    const y2 = 60 + 46 * Math.sin(fim);
    return {
      rotulo: fatia.rotulo,
      cor: fatia.cor,
      d: `M 60 60 L ${x1} ${y1} A 46 46 0 ${grande} 1 ${x2} ${y2} Z`,
    };
  });

  return (
    <div className="flex justify-center">
      <svg
        viewBox="0 0 120 120"
        className="h-52 w-52"
        role="img"
        aria-label="Participação por motorista"
      >
        {caminhos.map((fatia) => (
          <path key={fatia.rotulo} d={fatia.d} fill={fatia.cor} />
        ))}
      </svg>
    </div>
  );
}

function BarrasVeiculo({ periodo }: { periodo: RelatorioPeriodo }) {
  const veiculos = [...periodo.veiculos].sort((a, b) => b.kmRodados - a.kmRodados);
  const maior = Math.max(veiculos[0]?.kmRodados ?? 0, 1);

  return (
    <div className="space-y-3">
      {veiculos.map((veiculo) => (
        <div key={veiculo.id} className="grid grid-cols-[88px_1fr_64px] items-center gap-3">
          <span className="text-xs font-bold text-slate-600">{veiculo.codigo}</span>
          <div className="h-3 overflow-hidden rounded-full border border-slate-200/60 bg-slate-100">
            <div
              className={`h-full rounded-full ${veiculo.destaque ? "bg-indigo-500" : "bg-blue-600"}`}
              style={{ width: `${Math.round((veiculo.kmRodados / maior) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs font-semibold tabular-nums text-slate-500">
            {numero.format(veiculo.kmRodados)}
          </span>
        </div>
      ))}
    </div>
  );
}
