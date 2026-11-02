import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  FileWarning,
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

export const INTERVALO_POLLING_NOTIFICACOES_MS = 30_000;

function estiloTipoNotificacao(tipo: string): {
  Icone: React.ComponentType<{ className?: string }>;
  containerClass: string;
} {
  switch (tipo) {
    case "SOLICITACAO_URGENTE":
      return {
        Icone: AlertTriangle,
        containerClass: "bg-amber-100 text-amber-700",
      };
    case "VIAGEM_APROVADA":
      return {
        Icone: CheckCircle2,
        containerClass: "bg-emerald-100 text-emerald-700",
      };
    case "VIAGEM_RECUSADA":
      return {
        Icone: XCircle,
        containerClass: "bg-rose-100 text-rose-700",
      };
    case "CNH_VENCENDO":
    case "DOCUMENTO_VEICULO_VENCENDO":
      return {
        Icone: FileWarning,
        containerClass: "bg-orange-100 text-orange-700",
      };
    case "SVO_DESINFECCAO_CONCLUIDA":
      return {
        Icone: ShieldCheck,
        containerClass: "bg-sky-100 text-sky-700",
      };
    default:
      return {
        Icone: Bell,
        containerClass: "bg-slate-100 text-slate-700",
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
  const [filtro, setFiltro] = useState<"TODAS" | "NAO_LIDAS">("TODAS");
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [marcandoIds, setMarcandoIds] = useState<Record<string, boolean>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const aplicarResposta = useCallback(
    (resposta: Awaited<ReturnType<typeof listarNotificacoesApi>>) => {
      if (!montadoRef.current) return;
      setNotificacoes(resposta.data);
      setNaoLidas(resposta.meta.naoLidas);
    },
    [],
  );

  useEffect(() => {
    if (!browserSessionExpired()) {
      void listarNotificacoesApi({ limit: 25 })
        .then(aplicarResposta)
        .catch(() => {});
    }

    const atualizarEmSegundoPlano = () => {
      if (browserSessionExpired()) return;
      void listarNotificacoesApi({ limit: 25 })
        .then(aplicarResposta)
        .catch(() => {});
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
  }, [aplicarResposta]);

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

  function alternarDropdown() {
    const proximoEstado = !aberto;
    setAberto(proximoEstado);
    setErroAcao(null);
    if (proximoEstado && !browserSessionExpired()) {
      const mostrarLoading = notificacoes.length === 0;
      if (mostrarLoading) setCarregando(true);
      void listarNotificacoesApi({ limit: 25 })
        .then(aplicarResposta)
        .catch(() => {})
        .finally(() => {
          if (mostrarLoading && montadoRef.current) setCarregando(false);
        });
    }
  }

  async function marcarUmaComoLida(item: NotificacaoItem) {
    if (item.lida || marcandoIds[item.id]) return;

    setErroAcao(null);
    setMarcandoIds((atual) => ({ ...atual, [item.id]: true }));

    try {
      const atualizada = await marcarNotificacaoLidaApi(item.id);
      if (!montadoRef.current) return;

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
      setNaoLidas((total) => Math.max(0, total - 1));
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
            ? "flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/95 py-1.5 pr-3.5 pl-1.5 text-rose-900 shadow-xs ring-2 ring-rose-500/10 transition-all duration-200 hover:border-rose-300 hover:bg-rose-100/80 cursor-pointer"
            : "relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer"
        }
      >
        {naoLidas > 0 ? (
          <>
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-2xs">
              <BellRing className="h-3.5 w-3.5" />
              <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-50" />
              </span>
            </span>
            <span className="text-xs font-extrabold tracking-tight text-rose-900">
              <span data-testid="notificacoes-badge">{textoBadge}</span>{" "}
              {naoLidas === 1 ? "nova" : "novas"}
            </span>
          </>
        ) : (
          <Bell className="h-4.5 w-4.5" />
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Central de notificações"
          className="absolute right-0 z-40 mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">Notificações</h2>
              {naoLidas > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  {naoLidas} {naoLidas === 1 ? "nova" : "novas"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void marcarTodasComoLidas()}
              disabled={naoLidas === 0 || marcandoTodas}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Marcar todas como lidas</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2">
            <button
              type="button"
              onClick={() => setFiltro("TODAS")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                filtro === "TODAS"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFiltro("NAO_LIDAS")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                filtro === "NAO_LIDAS"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              Não lidas ({naoLidas})
            </button>
          </div>

          {erroAcao && (
            <div
              role="alert"
              className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700"
            >
              {erroAcao}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {carregando && notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-medium text-slate-500">
                Carregando alertas operacionais...
              </div>
            ) : notificacoesVisiveis.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-bold text-slate-700">
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
                      item.lida
                        ? "bg-white hover:bg-slate-50/70"
                        : "bg-sky-50/45 hover:bg-sky-50/80"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${containerClass}`}
                    >
                      <Icone className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            item.lida
                              ? "font-semibold text-slate-700"
                              : "font-extrabold text-slate-900"
                          }`}
                        >
                          {item.titulo}
                        </p>
                        {!item.lida && (
                          <span
                            aria-hidden="true"
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-600"
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
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-sky-700 transition-colors hover:bg-sky-100/80 disabled:opacity-50 cursor-pointer"
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
