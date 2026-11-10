import { AlertCircle } from "lucide-react";
import { Badge, Card } from "../../components/common";
import {
  motoristaElegivelParaViatura,
  viaturaElegivel,
  formatarHorarioTurno,
} from "./svoApresentacao";
import type { EscalaSvo, ViaturaSvo, MotoristaSvo } from "../../services/svo";

export function PlantaoSvo({
  escalasAtuais,
  viaturas,
  motoristas,
  carregandoEscalas,
  erroEscalas,
}: {
  escalasAtuais: EscalaSvo[];
  viaturas: ViaturaSvo[];
  motoristas: MotoristaSvo[];
  carregandoEscalas: boolean;
  erroEscalas: string;
}) {
  const viaturasElegiveis = viaturas.filter(viaturaElegivel);
  return (
    <Card
      className="overflow-hidden border-l-4 border-l-emerald-600 p-0"
      aria-label="Escala do plantão atual"
    >
      <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Plantão atual</h2>
            <Badge
              size="sm"
              variant={erroEscalas ? "danger" : carregandoEscalas ? "info" : "success"}
              dot={!erroEscalas}
            >
              {erroEscalas
                ? "Escala indisponível"
                : carregandoEscalas
                  ? "Atualizando"
                  : `${escalasAtuais.length} ${
                      escalasAtuais.length === 1 ? "escala ativa" : "escalas ativas"
                    }`}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Motoristas e viaturas escalados agora. A elegibilidade operacional é validada no
            despacho.
          </p>
        </div>
        {carregandoEscalas && (
          <span className="text-xs font-medium text-slate-500" role="status">
            Atualizando escalas...
          </span>
        )}
      </div>

      {erroEscalas ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-rose-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroEscalas}
        </div>
      ) : escalasAtuais.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          {carregandoEscalas
            ? "Carregando quem está de plantão..."
            : "Nenhuma escala em andamento neste momento."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200/70 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">
          {escalasAtuais.map((escala) => {
            const viatura = viaturas.find((item) => item.id === escala.veiculo.id);
            const motorista = motoristas.find((item) => item.id === escala.motorista.id);
            const elegivel =
              viaturasElegiveis.some((item) => item.id === escala.veiculo.id) &&
              !!motorista &&
              motoristaElegivelParaViatura(motorista, viatura);

            return (
              <li key={escala.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {escala.motorista.nome || "Motorista sem nome"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {escala.veiculo.modelo} ·{" "}
                      <span className="font-mono font-semibold text-slate-700">
                        {escala.veiculo.placa}
                      </span>
                    </p>
                  </div>
                  <Badge size="sm" dot variant={elegivel ? "success" : "neutral"}>
                    {elegivel ? "Pronto para despacho" : "Em turno"}
                  </Badge>
                </div>
                <div className="mt-2 font-mono text-xs text-slate-500 tabular-nums">
                  Turno {formatarHorarioTurno(escala.inicioTurno, escala.fimTurno)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
