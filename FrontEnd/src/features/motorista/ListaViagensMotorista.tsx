import { useState } from "react";
import { ArrowRight, CarFront, Clock3 } from "lucide-react";
import { horarioViagem, type ViagemMotorista } from "./viagensMotorista";
export default function ListaViagensMotorista({
  viagens,
  selecionada,
  onSelect,
}: {
  viagens: ViagemMotorista[];
  selecionada?: string;
  onSelect: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState("TODAS");
  const visiveis = viagens.filter((v) => filtro === "TODAS" || v.tipo === filtro);
  return (
    <div className="driver-trip-list">
      <p className="driver-hint">
        Todas as viagens atribuídas a você. Escolha uma para ver os detalhes e preparar a saída.
      </p>
      <nav className="driver-trip-filters" aria-label="Filtrar viagens">
        {[
          { key: "TODAS", label: "Todas", count: viagens.length },
          {
            key: "ADMINISTRATIVA",
            label: "Administrativas",
            count: viagens.filter((v) => v.tipo === "ADMINISTRATIVA").length,
          },
          { key: "SVO", label: "SVO", count: viagens.filter((v) => v.tipo === "SVO").length },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filtro === f.key}
            onClick={() => setFiltro(f.key)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </nav>
      {!visiveis.length && (
        <p className="driver-empty driver-hint">Nenhuma viagem atribuída nesta categoria.</p>
      )}
      {visiveis.map((v) => (
        <button
          key={v.id}
          className="driver-trip-option"
          type="button"
          aria-label={`Selecionar viagem para ${v.destino}`}
          aria-pressed={selecionada === v.id}
          onClick={() => onSelect(v.id)}
        >
          <div className="driver-trip-copy">
            <p className="driver-panel-label">
              {v.tipo === "SVO"
                ? `${v.coletas} coleta${v.coletas !== 1 ? "s" : ""} SVO`
                : `Administrativa · ${v.categoria}`}
            </p>
            <strong>{v.destino}</strong>
            <p className="driver-origin">Saída: {v.origem}</p>
            {horarioViagem(v.horario) && (
              <p className="driver-trip-meta">
                <Clock3 size={14} />
                {horarioViagem(v.horario)}
              </p>
            )}
            <p className="driver-trip-meta">
              <CarFront size={15} />
              {v.veiculo?.placa ?? "Aguardando veículo"}
              {v.passageiros
                ? ` · ${v.passageiros} passageiro${v.passageiros !== 1 ? "s" : ""}`
                : ""}
              {v.protocolo ? ` · ${v.protocolo}` : ""}
            </p>
          </div>
          <ArrowRight size={18} />
        </button>
      ))}
    </div>
  );
}
