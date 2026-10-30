import React, { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Fuel, Gauge, Route } from "lucide-react";
import { Button, Card, Table } from "../../components/common";
import type { Column } from "../../components/common/Table";
import { useAuth } from "../../contexts/auth";
import type { RelatorioPeriodo, RelatorioVeiculo } from "../../types/relatorio";
import { apiRequest } from "../../lib/api";
import { gerarCsv } from "../../lib/relatorioCsv";

type VisaoGrafico = "consolidado" | "veiculo" | "motorista";

const VISOES: { id: VisaoGrafico; label: string }[] = [
  { id: "consolidado", label: "Consolidado" },
  { id: "veiculo", label: "Veículo" },
  { id: "motorista", label: "Motorista" },
];

const CORES = ["#2563eb", "#4f46e5", "#64748b", "#0f172a", "#93c5fd"];

const numero = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
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

function exportarCsv(periodo: RelatorioPeriodo) {
  const csv = gerarCsv(periodo);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-frota-${periodo.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const colunas: Column<RelatorioVeiculo>[] = [
  {
    header: "Veículo",
    render: (veiculo) => (
      <div>
        <p className="font-bold text-slate-900">{veiculo.codigo}</p>
        <p className="text-xs text-slate-500">{veiculo.descricao}</p>
      </div>
    ),
  },
  {
    header: "Viagens/Coletas",
    render: (veiculo) => (
      <span>
        <span className="font-semibold text-slate-900">{veiculo.operacoes}</span>{" "}
        <span className="text-slate-500">{veiculo.unidade}</span>
      </span>
    ),
  },
  {
    header: "Km rodados",
    render: (veiculo) => numero.format(veiculo.kmRodados),
  },
  {
    header: "Km médio / Viagem",
    render: (veiculo) => (veiculo.kmMedio === null ? "—" : decimal.format(veiculo.kmMedio)),
  },
  {
    header: "Consumo total (L)",
    render: (veiculo) => numero.format(veiculo.consumoLitros),
  },
  {
    header: "Consumo médio / Viagem",
    render: (veiculo) =>
      veiculo.consumoMedio === null ? "—" : decimal.format(veiculo.consumoMedio),
  },
];

export const RelatoriosPage: React.FC = () => {
  const { user, token } = useAuth();
  const [hoje] = useState(() => new Date());
  const [intervalo, setIntervalo] = useState<IntervaloRelatorio>(intervaloInicial);
  const [visao, setVisao] = useState<VisaoGrafico>("consolidado");
  const [resposta, setResposta] = useState<{
    chave: string;
    dados: RelatorioPeriodo | null;
    erro: string;
  } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const chave = `${intervalo.inicio}_${intervalo.fim}_${token}_${tentativa}`;
  const periodo = resposta?.chave === chave ? resposta.dados : null;
  const erro = resposta?.chave === chave ? resposta.erro : "";
  useEffect(() => {
    let ativo = true;
    void apiRequest<RelatorioPeriodo>(
      `/relatorios?inicio=${intervalo.inicio}&fim=${intervalo.fim}`,
      { token },
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
  }, [intervalo.inicio, intervalo.fim, token, chave]);
  const primeiroNome = user?.nome?.split(" ")[0] || "Gestor";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
            {formatarDataAtual(hoje)}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
            Olá, {primeiroNome}!
          </h1>
        </div>

        <SeletorPeriodo intervalo={intervalo} onChange={setIntervalo} />
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
            período. Coletas SVO não possuem registro de quilometragem. Consumo por viagem e desvios
            de rota ainda não são registrados.
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
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Detalhamento por veículo</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quilometragem registrada e abastecimentos por veículo
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportarCsv(periodo)}
                disabled={periodo.veiculos.length === 0}
              >
                Exportar
              </Button>
            </div>
            {periodo.veiculos.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhum veículo no período selecionado.
              </p>
            ) : (
              <Table
                columns={colunas}
                data={periodo.veiculos}
                keyExtractor={(veiculo) => veiculo.id}
                emptyMessage="Nenhum veículo no período selecionado."
                className="border-0 shadow-none rounded-none"
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

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
