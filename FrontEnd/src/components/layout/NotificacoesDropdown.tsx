import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { browserSessionExpired } from "../../services/browserSession";
import {
  EVENTO_ATUALIZAR_NOTIFICACOES,
  listarNotificacoesApi,
  marcarNotificacaoLidaApi,
  marcarTodasNotificacoesLidasApi,
} from "../../services/notificacoesService";
import type { NotificacaoItem } from "../../types/notificacao";

const INTERVALO_POLLING_NOTIFICACOES_MS = 30_000;
const LIMITE_PADRAO_NOTIFICACOES = 25;

type FiltroNotificacoes = "TODAS" | "NAO_LIDAS";

function estiloTipoNotificacao(tipo: string): {
  Icone: React.ComponentType<{ className?: string }>;
  containerClass: string;
} {
  switch (tipo) {
    case "SOLICITACAO_URGENTE":
      return {
        Icone: AlertTriangle,
        containerClass: "bg-amber-50 text-amber-700 border border-amber-200",
      };
    case "VIAGEM_APROVADA":
      return {
        Icone: CheckCircle2,
        containerClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      };
    case "VIAGEM_RECUSADA":
      return {
        Icone: XCircle,
        containerClass: "bg-rose-50 text-rose-700 border border-rose-200",
      };
    case "REVISAO_PREVENTIVA_VENCIDA":
      return {
        Icone: AlertTriangle,
        containerClass: "bg-rose-50 text-rose-700 border border-rose-200",
      };
    case "REVISAO_PREVENTIVA_PROXIMA":
    case "CNH_VENCENDO":
    case "DOCUMENTO_VEICULO_VENCENDO":
      return {
        Icone: FileWarning,
        containerClass: "bg-amber-50 text-amber-800 border border-amber-200",
      };
    case "SVO_DESINFECCAO_CONCLUIDA":
      return {
        Icone: ShieldCheck,
        containerClass: "bg-blue-50 text-blue-700 border border-blue-200",
      };
    default:
      return {
        Icone: Bell,
        containerClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

function formatarTempoNotificacao(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";

  const diferencaSegundos = Math.floor((Date.now() - timestamp) / 1000);
  if (diferencaSegundos < 60) return "Agora";

  const minutos = Math.floor(diferencaSegundos / 60);
  if (minutos < 60) return `Há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Há ${horas} h`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export const NotificacoesDropdown: React.FC = () => {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroNotificacoes>("TODAS");
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [marcandoIds, setMarcandoIds] = useState<Record<string, boolean>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const montadoRef = useRef(true);
  const filtroRef = useRef<FiltroNotificacoes>("TODAS");
  const requisicaoIdRef = useRef(0);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const consultarNotificacoesSilenciosamente = useCallback((filtroAlvo?: FiltroNotificacoes) => {
    if (browserSessionExpired()) return Promise.resolve();
    const filtroConsulta = filtroAlvo ?? filtroRef.current;
    const idRequisicao = ++requisicaoIdRef.current;

    return listarNotificacoesApi({
      apenasNaoLidas: filtroConsulta === "NAO_LIDAS",
      limit: LIMITE_PADRAO_NOTIFICACOES,
    })
      .then((resposta) => {
        if (
          !montadoRef.current ||
          idRequisicao !== requisicaoIdRef.current ||
          filtroRef.current !== filtroConsulta
        ) {
          return;
        }
        setNotificacoes(resposta.data);
        setNaoLidas(resposta.meta.naoLidas);
        setErroCarregamento(null);
      })
      .catch(() => {
        if (
          !montadoRef.current ||
          browserSessionExpired() ||
          idRequisicao !== requisicaoIdRef.current ||
          filtroRef.current !== filtroConsulta
        ) {
          return;
        }
        setErroCarregamento("Não foi possível consultar as notificações.");
      });
  }, []);

  useEffect(() => {
    void consultarNotificacoesSilenciosamente();

    const atualizarEmSegundoPlano = () => {
      void consultarNotificacoesSilenciosamente();
    };

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        atualizarEmSegundoPlano();
      }
    }, INTERVALO_POLLING_NOTIFICACOES_MS);

    function aoMudarVisibilidade() {
      if (document.visibilityState === "visible") {
        atualizarEmSegundoPlano();
      }
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener(EVENTO_ATUALIZAR_NOTIFICACOES, atualizarEmSegundoPlano);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener(EVENTO_ATUALIZAR_NOTIFICACOES, atualizarEmSegundoPlano);
    };
  }, [consultarNotificacoesSilenciosamente]);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }

    function aoPressionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [aberto]);

  function carregarComFeedback(filtroAlvo: FiltroNotificacoes, mostrarLoading: boolean) {
    if (browserSessionExpired()) return;
    if (mostrarLoading) {
      setCarregando(true);
    }
    void consultarNotificacoesSilenciosamente(filtroAlvo).finally(() => {
      if (mostrarLoading && montadoRef.current) {
        setCarregando(false);
      }
    });
  }

  function alternarDropdown() {
    const proximoEstado = !aberto;
    setAberto(proximoEstado);
    setErroAcao(null);
    if (proximoEstado) {
      carregarComFeedback(filtroRef.current, notificacoes.length === 0);
    }
  }

  function selecionarFiltro(novoFiltro: FiltroNotificacoes) {
    if (novoFiltro === filtroRef.current && !erroCarregamento) return;
    filtroRef.current = novoFiltro;
    setFiltro(novoFiltro);
    setErroAcao(null);
    const temVisiveisLocais =
      novoFiltro === "NAO_LIDAS"
        ? notificacoes.some((item) => !item.lida)
        : notificacoes.length > 0;
    carregarComFeedback(novoFiltro, !temVisiveisLocais);
  }

  function tentarNovamente() {
    setErroCarregamento(null);
    setErroAcao(null);
    carregarComFeedback(filtroRef.current, true);
  }

  async function marcarUmaComoLida(item: NotificacaoItem) {
    if (item.lida || marcandoIds[item.id]) return;

    requisicaoIdRef.current += 1;
    setErroAcao(null);
    setMarcandoIds((atual) => ({ ...atual, [item.id]: true }));

    try {
      const atualizada = await marcarNotificacaoLidaApi(item.id);
      if (!montadoRef.current) return;

      const proximoTotalNaoLidas = Math.max(0, naoLidas - 1);
      const naoLidasRestantesCarregadas = notificacoes.filter(
        (n) => n.id !== item.id && !n.lida,
      ).length;

      setNotificacoes((lista) =>
        lista.map((n) =>
          n.id === item.id
            ? {
                ...n,
                lida: true,
                lidaEm: atualizada?.lidaEm ?? new Date().toISOString(),
              }
            : n,
        ),
      );
      setNaoLidas(proximoTotalNaoLidas);

      if (filtroRef.current === "NAO_LIDAS" && proximoTotalNaoLidas > naoLidasRestantesCarregadas) {
        void consultarNotificacoesSilenciosamente("NAO_LIDAS");
      }
    } catch {
      if (montadoRef.current) {
        setErroAcao("Não foi possível atualizar a notificação. Tente novamente.");
      }
    } finally {
      if (montadoRef.current) {
        setMarcandoIds((atual) => {
          const copia = { ...atual };
          delete copia[item.id];
          return copia;
        });
      }
    }
  }

  async function marcarTodasComoLidas() {
    if (naoLidas === 0 || marcandoTodas) return;

    requisicaoIdRef.current += 1;
    setErroAcao(null);
    setMarcandoTodas(true);

    try {
      await marcarTodasNotificacoesLidasApi();
      if (!montadoRef.current) return;

      const agoraIso = new Date().toISOString();
      setNotificacoes((lista) =>
        lista.map((item) => (item.lida ? item : { ...item, lida: true, lidaEm: agoraIso })),
      );
      setNaoLidas(0);
    } catch {
      if (montadoRef.current) {
        setErroAcao("Não foi possível marcar todas como lidas. Tente novamente.");
      }
    } finally {
      if (montadoRef.current) {
        setMarcandoTodas(false);
      }
    }
  }

  const notificacoesVisiveis = useMemo(
    () => (filtro === "NAO_LIDAS" ? notificacoes.filter((item) => !item.lida) : notificacoes),
    [filtro, notificacoes],
  );

  const naoLidasCarregadas = useMemo(
    () => notificacoes.filter((item) => !item.lida).length,
    [notificacoes],
  );
  const naoLidasAnterioresOcultas =
    filtro === "TODAS" && !carregando ? Math.max(0, naoLidas - naoLidasCarregadas) : 0;

  const textoBadge = naoLidas > 99 ? "99+" : String(naoLidas);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notificações"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={alternarDropdown}
        className={
          naoLidas > 0
            ? "flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-rose-900 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-100/70 cursor-pointer"
            : "relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
        }
      >
        {naoLidas > 0 ? (
          <>
            <span className="relative flex h-6 w-6 items-center justify-center rounded-md bg-rose-700 text-white">
              <BellRing className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold tracking-tight text-rose-900">
              <span data-testid="notificacoes-badge">{textoBadge}</span>{" "}
              {naoLidas === 1 ? "nova" : "novas"}
            </span>
          </>
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Central de notificações"
          className="fixed top-[4.5rem] right-4 z-40 flex max-h-[calc(100dvh-5rem)] w-[calc(100vw-2rem)] max-w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:top-full sm:right-0 sm:mt-1.5 sm:max-h-[calc(100vh-6rem)] sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Notificações</h2>
              {naoLidas > 0 && (
                <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                  {naoLidas} {naoLidas === 1 ? "nova" : "novas"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void marcarTodasComoLidas()}
              disabled={naoLidas === 0 || marcandoTodas}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Marcar todas como lidas</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => selecionarFiltro("TODAS")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                filtro === "TODAS"
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => selecionarFiltro("NAO_LIDAS")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                filtro === "NAO_LIDAS"
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Não lidas ({naoLidas})
            </button>
          </div>

          {naoLidasAnterioresOcultas > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-2 text-[11px] font-medium text-blue-900">
              <span>
                {naoLidasAnterioresOcultas === 1
                  ? "Há 1 pendência não lida mais antiga."
                  : `Há ${naoLidasAnterioresOcultas} pendências não lidas mais antigas.`}
              </span>
              <button
                type="button"
                onClick={() => selecionarFiltro("NAO_LIDAS")}
                className="shrink-0 font-semibold text-blue-700 underline-offset-2 hover:underline cursor-pointer"
              >
                Ver não lidas
              </button>
            </div>
          )}

          {erroAcao && (
            <div
              role="alert"
              className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800"
            >
              {erroAcao}
            </div>
          )}

          {erroCarregamento && notificacoesVisiveis.length > 0 && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800"
            >
              <span>Falha ao atualizar as notificações.</span>
              <button
                type="button"
                onClick={tentarNovamente}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Tentar novamente</span>
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-200/70">
            {carregando && notificacoesVisiveis.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-medium text-slate-500">
                Carregando alertas operacionais...
              </div>
            ) : erroCarregamento && notificacoesVisiveis.length === 0 ? (
              <div role="alert" className="px-4 py-8 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-slate-800">{erroCarregamento}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Não foi possível confirmar se há alertas pendentes no momento.
                </p>
                <button
                  type="button"
                  onClick={tentarNovamente}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            ) : notificacoesVisiveis.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-700">
                  {filtro === "NAO_LIDAS"
                    ? "Nenhuma notificação não lida."
                    : "Nenhuma notificação no momento."}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Alertas de viagens, documentos e desinfecção aparecerão aqui.
                </p>
              </div>
            ) : (
              notificacoesVisiveis.map((item) => {
                const { Icone, containerClass } = estiloTipoNotificacao(item.tipo);
                const emAtualizacao = Boolean(marcandoIds[item.id]);

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                      item.lida ? "bg-white hover:bg-slate-50" : "bg-blue-50/35 hover:bg-blue-50/60"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${containerClass}`}
                    >
                      <Icone className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            item.lida ? "font-medium text-slate-700" : "font-bold text-slate-900"
                          }`}
                        >
                          {item.titulo}
                        </p>
                        {!item.lida && (
                          <span
                            aria-hidden="true"
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                          />
                        )}
                      </div>

                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                        {item.mensagem}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatarTempoNotificacao(item.criadoEm)}
                        </span>

                        {!item.lida && (
                          <button
                            type="button"
                            disabled={emAtualizacao}
                            onClick={() => void marcarUmaComoLida(item)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100/70 disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            <span>Marcar como lida</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
