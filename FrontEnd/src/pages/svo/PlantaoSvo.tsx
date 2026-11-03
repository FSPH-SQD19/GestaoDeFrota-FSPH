import { AlertCircle, Ambulance, Clock3, Users } from "lucide-react";
import { Badge, Card } from "../../components/common";
import { cn } from "../../lib/utils";
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
      className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-0 shadow-sm"
      aria-label="Escala do plantão atual"
    >
      <div className="flex flex-col gap-3 border-b border-emerald-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Plantão atual</h2>
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
            <p className="mt-1 text-xs text-slate-600">
              Motoristas e viaturas escalados agora. A elegibilidade operacional é validada no
              despacho.
            </p>
          </div>
        </div>
        {carregandoEscalas && (
          <span className="text-xs font-medium text-slate-500" role="status">
            Atualizando escalas...
          </span>
        )}
      </div>

      {erroEscalas ? (
        <div className="flex items-center gap-2 p-5 text-sm text-rose-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroEscalas}
        </div>
      ) : escalasAtuais.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">
          {carregandoEscalas
            ? "Carregando quem está de plantão..."
            : "Nenhuma escala em andamento neste momento."}
        </p>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {escalasAtuais.map((escala) => {
            const viatura = viaturas.find((item) => item.id === escala.veiculo.id);
            const motorista = motoristas.find((item) => item.id === escala.motorista.id);
            const elegivel =
              viaturasElegiveis.some((item) => item.id === escala.veiculo.id) &&
              !!motorista &&
              motoristaElegivelParaViatura(motorista, viatura);

            return (
              <li
                key={escala.id}
                className={cn(
                  "rounded-xl border bg-white p-4",
                  elegivel ? "border-emerald-200" : "border-slate-200",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {escala.motorista.nome || "Motorista sem nome"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <Ambulance className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {escala.veiculo.modelo} · {escala.veiculo.placa}
                      </span>
                    </p>
                  </div>
                  <Badge size="sm" dot variant={elegivel ? "success" : "neutral"}>
                    {elegivel ? "Pronto para despacho" : "Em turno"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
                  <Users className="h-3.5 w-3.5" />
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
