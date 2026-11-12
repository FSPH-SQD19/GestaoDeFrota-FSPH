import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import { Badge, Button } from "../../components/common";
import { atualizarMultaApi, obterMultasMotoristaApi } from "../../services/multasService";
import type { Multa, ResumoMultasMotorista, StatusMulta } from "../../types/multa";

interface SecaoMultasMotoristaProps {
  motoristaId: string;
  onNovaMultaClick?: () => void;
  versaoExterno?: number;
}

const dataAgoraIso = () => new Date().toISOString();

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarData = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const statusBadge: Record<StatusMulta, { variant: "warning" | "success" | "info"; label: string }> =
  {
    PENDENTE: { variant: "warning", label: "Pendente" },
    PAGA: { variant: "success", label: "Paga" },
    EM_RECURSO: { variant: "info", label: "Em recurso" },
  };

export const SecaoMultasMotorista: React.FC<SecaoMultasMotoristaProps> = ({
  motoristaId,
  onNovaMultaClick,
  versaoExterno = 0,
}) => {
  const [resumo, setResumo] = useState<ResumoMultasMotorista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;

    if (!motoristaId) {
      return () => {
        ativo = false;
      };
    }

    obterMultasMotoristaApi(motoristaId)
      .then((dados) => {
        if (ativo) {
          setResumo(dados);
          setErro(null);
        }
      })
      .catch(() => {
        if (ativo) {
          setErro("Não foi possível carregar o histórico de infrações deste condutor.");
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [motoristaId, versao, versaoExterno]);

  const handleAlterarStatus = async (multaId: string, novoStatus: StatusMulta) => {
    try {
      setAtualizandoId(multaId);
      const dataPagamento = novoStatus === "PAGA" ? dataAgoraIso() : null;
      await atualizarMultaApi(multaId, {
        status: novoStatus,
        dataPagamento,
      });
      setVersao((v) => v + 1);
    } catch {
      setErro("Falha ao atualizar o status da multa.");
    } finally {
      setAtualizandoId(null);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-500">
        <Clock className="mr-2 h-4 w-4 animate-spin text-slate-400" />
        Carregando histórico de infrações...
      </div>
    );
  }

  const pontos = resumo?.totalPontos ?? 0;
  const situacaoPontos = pontos >= 20 ? "danger" : pontos >= 10 ? "warning" : "success";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-bold text-slate-900">Infrações & Pontuação na CNH</h4>
        {onNovaMultaClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNovaMultaClick}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            className="whitespace-nowrap"
          >
            Registrar Infração
          </Button>
        )}
      </div>

      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          {erro}
        </div>
      )}

      {/* Resumo de Infrações */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pontos Ativos (CNH)</span>
            <span className="text-[10px] text-slate-400">Últimos 12m (CTB)</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-slate-900">{pontos} pts</span>
            <Badge variant={situacaoPontos} size="sm">
              {pontos >= 20 ? "Alerta Suspensão" : pontos >= 10 ? "Atenção" : "Regular"}
            </Badge>
          </div>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-3.5">
          <span className="text-xs font-medium text-slate-500">Total de Infrações</span>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
            {resumo?.totalMultas ?? 0} auto(s)
          </p>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-3.5">
          <span className="text-xs font-medium text-slate-500">Valor Acumulado</span>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
            {formatarMoeda(resumo?.valorTotal ?? 0)}
          </p>
        </div>
      </div>

      {/* Lista de Infrações */}
      {resumo?.multas && resumo.multas.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Auto
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Data
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Veículo
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Gravidade
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Valor
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                  Status
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[11px] text-right">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-slate-700">
              {resumo.multas.map((multa: Multa) => {
                const badge = statusBadge[multa.status] || {
                  variant: "neutral",
                  label: multa.status,
                };
                return (
                  <tr key={multa.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                      {multa.autoInfracao}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {formatarData(multa.dataHora)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-semibold text-slate-800">
                        {multa.veiculo?.placa || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {multa.expirada ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-600">{multa.gravidade}</span>
                          <span className="text-[11px] text-slate-400">
                            <span className="line-through">{multa.pontos} pts</span> (expirado CTB)
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-700">
                          {multa.gravidade} ({multa.pontos} pts)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                      {formatarMoeda(multa.valor)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {multa.status === "PENDENTE" ? (
                        <button
                          type="button"
                          disabled={atualizandoId === multa.id}
                          onClick={() => handleAlterarStatus(multa.id, "PAGA")}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Quitar
                        </button>
                      ) : multa.status === "PAGA" ? (
                        <span className="text-slate-400">Quitada</span>
                      ) : (
                        <button
                          type="button"
                          disabled={atualizandoId === multa.id}
                          onClick={() => handleAlterarStatus(multa.id, "PAGA")}
                          className="font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Nenhuma infração registrada para este condutor na frota da FSPH.</span>
        </div>
      )}
    </div>
  );
};
