import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/auth";
import { api } from "../../services/api";
import { confirmarSaidaSessao, limparSaidaSessao } from "../../services/browserSession";
import {
  atualizarOffline,
  carregarTarefas,
  lerOffline,
  mensagemErro,
  sincronizar,
} from "./offline";
import type { Comando, Offline, Rota, Checklist, Veiculo } from "./types";
import { useRastreamento } from "./useRastreamento";
import { distanciaDaRota } from "./geo";
export type Inicio = {
  id: string;
  tipo: "ADMINISTRATIVA" | "SVO";
  tarefaId: string;
  veiculo: Veiculo;
};
export function useDiarioMotorista() {
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; razaoSocial: string }>>([]);
  const { user } = useAuth();
  const userId = user!.id;
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [state, setState] = useState<Offline>({ posicoes: [], comandos: [] }),
    [erro, setErro] = useState(""),
    [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const current = state.tarefas?.ativa;
  const encerrando =
    !!current &&
    state.comandos.some((p) => p.saidaId === current.id && p.comando.tipo === "ENCERRAR");
  const gps = useRastreamento(userId, current?.id, !!enabled && !encerrando);
  const mounted = useRef(true),
    syncing = useRef(false);
  const refresh = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      if (navigator.onLine) {
        await sincronizar(userId);
        const tarefas = await carregarTarefas(userId);
        if (tarefas.ativa && tarefas.sessaoExpiraEm)
          confirmarSaidaSessao(userId, tarefas.ativa.id, tarefas.sessaoExpiraEm);
        else limparSaidaSessao();
      }
      if (mounted.current) {
        setState(await lerOffline(userId));
        setErro("");
      }
    } catch (e) {
      if (mounted.current) {
        setErro(mensagemErro(e));
        setState(await lerOffline(userId));
      }
    } finally {
      syncing.current = false;
    }
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    void lerOffline(userId)
      .then((s) => {
        if (mounted.current) {
          setState(s);
          if (!navigator.onLine && s.tarefas) {
            setEnabled(true);
            if (s.tarefas.ativa && s.tarefas.sessaoExpiraEm)
              confirmarSaidaSessao(userId, s.tarefas.ativa.id, s.tarefas.sessaoExpiraEm);
          }
        }
      })
      .catch((e) => setErro(mensagemErro(e)));
    void api
      .get<{ enabled: boolean }>("/api/v1/motorista/config")
      .then(({ data }) => {
        if (mounted.current) setEnabled(data.enabled);
        if (data.enabled) {
          void refresh();
          void api
            .get<Array<{ id: string; razaoSocial: string }>>("/api/v1/motorista/fornecedores")
            .then(({ data }) => {
              if (mounted.current) setFornecedores(data);
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (mounted.current) setErro(mensagemErro(e));
      });
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) limparSaidaSessao();
      });
    };
  }, [refresh, userId]);
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      setOnline(navigator.onLine);
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(run, 5000);
    window.addEventListener("online", run);
    window.addEventListener("offline", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("offline", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, refresh]);
  const routeRef = useRef<Rota | undefined>(state.rota);
  useEffect(() => {
    routeRef.current = state.rota;
  }, [state.rota]);
  const lastRoute = useRef(0),
    deviations = useRef(0),
    routing = useRef(false),
    processedSample = useRef("");
  const calcular = useCallback(
    async (manual = false) => {
      if (!current || !gps.posicao || !navigator.onLine || routing.current) return;
      if (!manual && Date.now() - lastRoute.current < 30000) return;
      routing.current = true;
      lastRoute.current = Date.now();
      try {
        const { data } = await api.post<Rota>(`/api/v1/motorista/saidas/${current.id}/rota`, {
          origem: gps.posicao.coordenadas,
        });
        await atualizarOffline(userId, (s) => ({ ...s, rota: data }));
        if (mounted.current) setState((s) => ({ ...s, rota: data }));
        deviations.current = 0;
      } catch (e) {
        if (mounted.current) setErro(mensagemErro(e));
      } finally {
        routing.current = false;
      }
    },
    [current, gps.posicao, userId],
  );
  useEffect(() => {
    if (!current || encerrando || !gps.posicao || gps.posicao.precisao > 100) return;
    const rota = routeRef.current;
    const proximo =
      current.tipo === "SVO"
        ? current.pontos.find(
            (p) => p.id === "base" || !current.ordens.find((o) => o.ordemId === p.id)?.visitadaEm,
          )
        : current.pontos.find((p) => p.id === "destino");
    if (!rota || rota.destino.id !== proximo?.id) {
      void calcular();
      return;
    }
    if (processedSample.current === gps.posicao.id) return;
    processedSample.current = gps.posicao.id;
    if (distanciaDaRota(gps.posicao.coordenadas, rota.geometry.coordinates) > 50)
      deviations.current++;
    else deviations.current = 0;
    if (deviations.current >= 2) void calcular();
  }, [current, encerrando, gps.posicao, calcular]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setErro("");
    try {
      await work();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setBusy(false);
    }
  }
  async function enfileirar(comando: Comando) {
    if (!current) throw new Error("Sem saída ativa.");
    await atualizarOffline(userId, (s) => ({
      ...s,
      comandos: [...s.comandos, { saidaId: current.id, comando }],
    }));
    setState(await lerOffline(userId));
    await refresh();
  }

  async function iniciar(inicio: Inicio, kmInicial: number, checklist: Checklist) {
    if (!navigator.onLine) throw new Error("Conecte-se para iniciar a viagem.");
    const { data } = await api.post("/api/v1/motorista/saidas", {
      id: inicio.id,
      tipo: inicio.tipo,
      tarefaId: inicio.tarefaId,
      veiculoId: inicio.veiculo.id,
      kmInicial,
      checklist,
    });
    await atualizarOffline(userId, (s) => ({
      ...s,
      rota: undefined,
      tarefas: s.tarefas ? { ...s.tarefas, ativa: data } : undefined,
    }));
    setState(await lerOffline(userId));
    await refresh();
  }
  async function corrigir(id: string, comando: Comando) {
    await atualizarOffline(userId, (s) => ({
      ...s,
      comandos: s.comandos.map((c) =>
        c.comando.id === id ? { ...c, comando: { ...comando, id }, erro: undefined } : c,
      ),
    }));
    await refresh();
  }
  return {
    user: user!,
    state,
    enabled,
    busy,
    erro,
    online,
    current,
    encerrando,
    gps,
    fornecedores,
    action,
    refresh,
    calcular,
    iniciar,
    enfileirar,
    corrigir,
  };
}
