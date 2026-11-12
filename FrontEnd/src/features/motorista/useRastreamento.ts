import { useEffect, useRef, useState } from "react";
import { atualizarOffline } from "./offline";
import type { Posicao } from "./types";
export function useRastreamento(userId: string, saidaId: string | undefined, enabled: boolean) {
  const [posicao, setPosicao] = useState<Posicao>(),
    [erro, setErro] = useState("");
  const ultimoEnvio = useRef(0);
  useEffect(() => {
    if (!saidaId || !enabled) return;
    if (!navigator.geolocation) {
      queueMicrotask(() => setErro("Localização não disponível neste aparelho."));
      return;
    }
    let watch: number | undefined,
      cancelled = false,
      epoch = 0,
      release: (() => void) | undefined;
    const stop = () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      watch = undefined;
      release?.();
      release = undefined;
    };
    const start = () => {
      stop();
      const generation = ++epoch;
      if (document.visibilityState !== "visible") return;
      const capture = () =>
        new Promise<void>((resolve) => {
          if (cancelled || generation !== epoch || document.visibilityState !== "visible") {
            resolve();
            return;
          }
          release = resolve;
          watch = navigator.geolocation.watchPosition(
            (p) => {
              if (cancelled || generation !== epoch || document.visibilityState !== "visible")
                return;
              const ponto: Posicao = {
                id: crypto.randomUUID(),
                coordenadas: [p.coords.longitude, p.coords.latitude],
                capturadaEm: new Date(p.timestamp).toISOString(),
                precisao: p.coords.accuracy,
                velocidade: p.coords.speed,
                direcao: p.coords.heading,
              };
              setPosicao(ponto);
              setErro(ponto.precisao > 100 ? "Sinal GPS com baixa precisão." : "");
              const intervalo = p.coords.speed === null || p.coords.speed > 0.5 ? 5000 : 30000;
              if (Date.now() - ultimoEnvio.current < intervalo) return;
              ultimoEnvio.current = Date.now();
              void atualizarOffline(userId, (s) => ({
                ...s,
                posicoes: [...s.posicoes, { saidaId, posicao: ponto }],
              })).catch(() => setErro("Não foi possível guardar a posição no aparelho."));
            },
            (e) =>
              setErro(
                e.code === 1
                  ? "Permita acesso à localização para compartilhar sua posição."
                  : "GPS indisponível. Aguardando sinal.",
              ),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          );
        });
      if (navigator.locks)
        void navigator.locks.request(`rota-gps-${userId}`, { ifAvailable: true }, (lock) =>
          lock ? capture() : Promise.resolve(),
        );
      else void capture();
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", start);
    };
  }, [userId, saidaId, enabled]);
  return { posicao, erro };
}
