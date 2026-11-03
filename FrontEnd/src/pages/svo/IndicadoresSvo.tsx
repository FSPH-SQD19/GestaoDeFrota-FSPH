import type React from "react";
import { Activity, Ambulance, Clock3, Phone } from "lucide-react";
import { Card } from "../../components/common";
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
        value={`${indicadores.viaturasDisponiveis}/${indicadores.totalViaturas || totalViaturas}`}
        caption="Liberadas para despacho"
        tone="green"
      />
    </section>
  );
}
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
