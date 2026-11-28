import { Clock, ShieldCheck } from "lucide-react";
import type { ItemHistoricoPublicoSeguro } from "../../services/svo";
import { formatarDataHoraColeta, rotuloEtapaHistoricoSvo } from "./svoApresentacao";

interface Props {
  historico?: ItemHistoricoPublicoSeguro[];
  carregando?: boolean;
}

export function HistoricoPublicoSvo({ historico = [], carregando = false }: Props) {
  return (
    <section
      aria-label="Histórico público da solicitação"
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Histórico público de acompanhamento
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">Registro auditável (LGPD)</span>
      </div>

      {carregando ? (
        <p className="mt-3 text-xs text-slate-500">Carregando histórico atualizado...</p>
      ) : historico.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Nenhuma movimentação pública registrada até o momento.
        </p>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
          {historico.map((evento) => (
            <li key={evento.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-700"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {rotuloEtapaHistoricoSvo(evento.etapa)}
                </span>
                <time
                  dateTime={evento.registradoEm}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500"
                >
                  <Clock className="h-3 w-3 text-slate-400" />
                  {formatarDataHoraColeta(evento.registradoEm)}
                </time>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{evento.mensagem}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
