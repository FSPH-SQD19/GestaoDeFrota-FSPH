import { Ambulance, CheckCircle2, ShieldAlert, Users } from "lucide-react";
import { Badge, Button, Card } from "../../components/common";
import { cn } from "../../lib/utils";
import { rotuloStatusViatura } from "./svoApresentacao";
import type { ViaturaSvo } from "../../services/svo";
export function FrotaSvo({
  viaturas,
  processandoAcaoId,
  handleConcluirDesinfeccao,
}: {
  viaturas: ViaturaSvo[];
  processandoAcaoId: string | null;
  handleConcluirDesinfeccao: (viatura: ViaturaSvo) => void;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Painel das viaturas SVO</h2>
          <p className="mt-1 text-xs text-slate-500">
            Capacidade operacional e status sanitário da frota exclusiva.
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Ambulance className="h-4.5 w-4.5" />
        </span>
      </div>

      <div className="space-y-3 p-4">
        {viaturas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            Nenhuma viatura cadastrada na frota exclusiva do SVO.
          </div>
        ) : (
          viaturas.map((v) => {
            const disponivel = v.status === "DISPONIVEL";
            const desinfec = v.status === "DESINFECCAO";
            const infoStatus = rotuloStatusViatura(v.status);
            const cap = Math.max(1, v.capacidadeMaxima);
            const percentual = Math.min(100, Math.round((v.ocupacaoAtual / cap) * 100));
            const liberandoEsta = processandoAcaoId === v.id;

            return (
              <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        disponivel
                          ? "bg-emerald-50 text-emerald-600"
                          : desinfec
                            ? "bg-amber-50 text-amber-600"
                            : "bg-blue-50 text-blue-600",
                      )}
                    >
                      <Ambulance className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{v.modelo}</p>
                      <p className="font-mono text-[11px] text-slate-500">{v.placa}</p>
                    </div>
                  </div>
                  <Badge size="sm" dot variant={infoStatus.variant}>
                    {infoStatus.label}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {v.motoristaAtual?.nome || "Sem condutor alocado"}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {v.ocupacaoAtual}/{v.capacidadeMaxima} vagas
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      v.ocupacaoAtual >= v.capacidadeMaxima
                        ? "bg-rose-500"
                        : v.ocupacaoAtual >= Math.max(1, v.capacidadeMaxima - 1)
                          ? "bg-amber-500"
                          : "bg-blue-500",
                    )}
                    style={{ width: `${percentual}%` }}
                  />
                </div>

                {desinfec && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={liberandoEsta}
                    onClick={() => handleConcluirDesinfeccao(v)}
                  >
                    {liberandoEsta ? "Liberando..." : "Confirmar desinfecção"}{" "}
                    <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}

                {disponivel && (
                  <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Liberada para nova coleta
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Regra operacional:</strong> a quantidade de coletas ativas respeita a capacidade
          máxima de cada viatura SVO. Ao concluir a entrega, a unidade entra em bloqueio sanitário
          até a confirmação da desinfecção.
        </span>
      </div>
    </Card>
  );
}
