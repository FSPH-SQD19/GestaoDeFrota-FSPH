import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, Plus, ShieldAlert } from "lucide-react";
import { Badge, Button } from "../../components/common";
import { atualizarMultaApi, obterMultasMotoristaApi } from "../../services/multasService";
import type { Multa, ResumoMultasMotorista, StatusMulta } from "../../types/multa";

interface SecaoMultasMotoristaProps {
  motoristaId: string;
  onNovaMultaClick?: () => void;
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
  }, [motoristaId, versao]);

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
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-slate-700" />
          <h4 className="font-bold text-slate-900">Infrações & Pontuação na CNH</h4>
        </div>
        {onNovaMultaClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNovaMultaClick}
            className="self-start text-xs font-semibold sm:self-auto"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Registrar Infração
          </Button>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          {erro}
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Pontos Acumulados</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">{pontos} pts</span>
            <Badge variant={situacaoPontos} size="sm">
              {pontos >= 20 ? "Alerta Suspensão" : pontos >= 10 ? "Atenção" : "Regular"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total de Infrações</span>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {resumo?.totalMultas ?? 0} auto(s)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Valor Acumulado</span>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatarMoeda(resumo?.valorTotal ?? 0)}
          </p>
        </div>
      </div>

      {/* Lista de Infrações */}
      {resumo?.multas && resumo.multas.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Auto</th>
                <th className="px-3 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">Veículo</th>
                <th className="px-3 py-2 font-semibold">Gravidade</th>
                <th className="px-3 py-2 font-semibold">Valor</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {resumo.multas.map((multa: Multa) => {
                const badge = statusBadge[multa.status] || {
                  variant: "neutral",
                  label: multa.status,
                };
                return (
                  <tr key={multa.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{multa.autoInfracao}</td>
                    <td className="px-3 py-2.5 text-slate-500">{formatarData(multa.dataHora)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-800">
                        {multa.veiculo?.placa || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-700">
                        {multa.gravidade} ({multa.pontos} pts)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
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
                          className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
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
                          className="font-medium text-slate-500 hover:text-slate-800 hover:underline"
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
        <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs text-slate-500 border border-slate-200/50">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Nenhuma infração registrada para este condutor na frota da FSPH.</span>
        </div>
      )}
    </div>
  );
};
