import { Card } from "../../components/common";
import { formatarDuracaoSla } from "../../lib/svoSla";
import { cn } from "../../lib/utils";
import type { IndicadoresSvo as Indicadores } from "../../services/svo";

export function IndicadoresSvo({
  indicadores,
  totalViaturas,
}: {
  indicadores: Indicadores;
  totalViaturas: number;
}) {
  return (
    <div className="space-y-3.5">
      <section aria-label="Indicadores SVO" className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Metric
          label="Chamados registrados"
          value={indicadores.total}
          caption={`${indicadores.aprovados} aprovados`}
          tone="neutral"
        />
        <Metric
          label="Aguardando triagem"
          value={indicadores.emAnalise}
          caption={`${indicadores.aguardandoOrdem} aguardando ordem`}
          tone={indicadores.emAnalise > 0 ? "amber" : "neutral"}
        />
        <Metric
          label="Coletas em andamento"
          value={indicadores.coletasEmAndamento}
          caption="Após registrar saída"
          tone={indicadores.coletasEmAndamento > 0 ? "blue" : "neutral"}
        />
        <Metric
          label="Viaturas disponíveis"
          value={`${indicadores.viaturasDisponiveis}/${indicadores.totalViaturas || totalViaturas}`}
          caption="Liberadas para despacho"
          tone={indicadores.viaturasDisponiveis > 0 ? "green" : "neutral"}
        />
      </section>
      <section aria-label="SLA de resposta SVO" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Metric
          label="Tempo médio até o local"
          value={formatarDuracaoSla(indicadores.tempoMedioChegadaLocalMinutos)}
          caption="Chamado → chegada"
          tone="amber"
        />
        <Metric
          label="Tempo médio até a entrega"
          value={formatarDuracaoSla(indicadores.tempoMedioEntregaSvoMinutos)}
          caption="Chamado → SVO"
          tone="blue"
        />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string | number;
  caption: string;
  tone: "neutral" | "blue" | "amber" | "green";
}) {
  const valueTone = {
    neutral: "text-slate-900",
    blue: "text-blue-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
  };
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={cn("text-2xl font-bold tracking-tight tabular-nums", valueTone[tone])}>
          {value}
        </p>
        <span className="text-xs text-slate-500">{caption}</span>
      </div>
    </Card>
  );
}
