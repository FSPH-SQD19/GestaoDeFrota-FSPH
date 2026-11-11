import { CheckCircle2, ShieldAlert } from "lucide-react";
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
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Painel das viaturas SVO</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Capacidade operacional e status sanitário da frota exclusiva.
        </p>
      </div>

      <div className="divide-y divide-slate-200/70">
        {viaturas.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Nenhuma viatura cadastrada na frota exclusiva do SVO.
          </div>
        ) : (
          viaturas.map((v) => {
            const disponivel = v.status === "DISPONIVEL";
            const reservada = disponivel && v.ocupacaoAtual > 0;
            const desinfec = v.status === "DESINFECCAO";
            const infoStatus = reservada
              ? { label: "Aguardando despacho", variant: "warning" as const }
              : rotuloStatusViatura(v.status);
            const cap = Math.max(1, v.capacidadeMaxima);
            const percentual = Math.min(100, Math.round((v.ocupacaoAtual / cap) * 100));
            const liberandoEsta = processandoAcaoId === v.id;

            return (
              <div key={v.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{v.modelo}</p>
                    <p className="font-mono text-xs font-semibold text-slate-600">{v.placa}</p>
                  </div>
                  <Badge size="sm" dot variant={infoStatus.variant}>
                    {infoStatus.label}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {v.motoristaAtual?.nome || "Sem condutor alocado"}
                  </span>
                  <span className="font-mono font-semibold text-slate-700 tabular-nums">
                    {v.ocupacaoAtual}/{v.capacidadeMaxima} vagas
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      v.ocupacaoAtual >= v.capacidadeMaxima
                        ? "bg-rose-600"
                        : v.ocupacaoAtual >= Math.max(1, v.capacidadeMaxima - 1)
                          ? "bg-amber-500"
                          : "bg-slate-800",
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

                {disponivel && !reservada && (
                  <p className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Liberada para nova coleta
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 text-xs leading-relaxed text-slate-600">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong className="font-semibold text-slate-800">Regra operacional:</strong> a
            quantidade de coletas ativas respeita a capacidade máxima de cada viatura SVO. Ao
            concluir a entrega, a unidade entra em bloqueio sanitário até a confirmação da
            desinfecção.
          </span>
        </div>
      </div>
    </Card>
  );
}
