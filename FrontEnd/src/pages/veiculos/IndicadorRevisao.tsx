const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function IndicadorRevisao({
  odometroAtual,
  kmProximaRevisao,
}: {
  odometroAtual: number;
  kmProximaRevisao: number | null;
}) {
  if (kmProximaRevisao == null) {
    return (
      <div className="space-y-1 text-sm">
        <p>Odômetro atual · {numero.format(odometroAtual)} km</p>
        <p className="text-slate-600">Próxima revisão ainda não configurada.</p>
      </div>
    );
  }
  const odometroEmCentesimos = Math.round(odometroAtual * 100);
  const limiteEmCentesimos = Math.round(kmProximaRevisao * 100);
  const percentual = (odometroEmCentesimos * 100) / limiteEmCentesimos;
  const progresso = Math.min(100, Math.max(0, percentual));
  const textoPercentual = numero.format(
    Math.floor((odometroEmCentesimos * 1000) / limiteEmCentesimos) / 10,
  );
  const cor =
    percentual >= 100 ? "bg-rose-600" : percentual >= 90 ? "bg-amber-500" : "bg-emerald-600";
  const situacao =
    percentual >= 100
      ? "Revisão necessária"
      : percentual >= 90
        ? "Próxima da revisão"
        : "Revisão em dia";

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span>Odômetro atual · {numero.format(odometroAtual)} km</span>
        <strong>{textoPercentual}%</strong>
      </div>
      <div
        role="progressbar"
        aria-label="Quilometragem até a próxima revisão"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progresso}
        aria-valuetext={`${textoPercentual}% do limite da próxima revisão`}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${progresso}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <span>Próxima revisão · {numero.format(kmProximaRevisao)} km</span>
        <strong
          className={
            percentual >= 100
              ? "text-rose-700"
              : percentual >= 90
                ? "text-amber-800"
                : "text-emerald-800"
          }
        >
          {situacao}
        </strong>
      </div>
    </div>
  );
}
