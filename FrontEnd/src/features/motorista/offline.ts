import { openDB } from "idb";
import { api, resetCsrf } from "../../services/api";
import type { Offline, Tarefas } from "./types";
const database = () =>
  openDB("rota-motorista", 1, {
    upgrade(db) {
      db.createObjectStore("usuarios");
    },
  });
export async function lerOffline(userId: string): Promise<Offline> {
  const db = await database();
  try {
    return (await db.get("usuarios", userId)) ?? { posicoes: [], comandos: [] };
  } finally {
    db.close();
  }
}
export async function atualizarOffline(userId: string, update: (s: Offline) => Offline) {
  const db = await database();
  try {
    const tx = db.transaction("usuarios", "readwrite");
    const current: Offline = (await tx.store.get(userId)) ?? { posicoes: [], comandos: [] };
    await tx.store.put(update(current), userId);
    await tx.done;
  } finally {
    db.close();
  }
}
export async function limparOfflineSincronizado(userId: string) {
  const db = await database();
  try {
    const tx = db.transaction("usuarios", "readwrite");
    const state: Offline | undefined = await tx.store.get(userId);
    if (state && !state.posicoes.length && !state.comandos.length) await tx.store.delete(userId);
    await tx.done;
  } finally {
    db.close();
  }
}
export function mensagemErro(e: unknown) {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? "Falha ao sincronizar.";
}
const running = new Map<string, Promise<void>>();
export function sincronizar(userId: string): Promise<void> {
  const prev = running.get(userId);
  if (prev) return prev;
  const work = async () => {
    if (!navigator.onLine) return;
    const sessao = await api.get<{ usuario: { id: string } }>("/api/v1/auth/sessao");
    if (sessao.data.usuario.id !== userId)
      throw new Error("Entre com o mesmo usuário para sincronizar.");
    resetCsrf();
    let state = await lerOffline(userId);
    while (state.posicoes.length) {
      const saidaId = state.posicoes[0].saidaId;
      const lote = state.posicoes.filter((p) => p.saidaId === saidaId).slice(0, 50);
      await api.post(`/api/v1/motorista/saidas/${saidaId}/posicoes`, {
        posicoes: lote.map((p) => p.posicao),
      });
      const ids = new Set(lote.map((p) => p.posicao.id));
      await atualizarOffline(userId, (s) => ({
        ...s,
        posicoes: s.posicoes.filter((p) => !ids.has(p.posicao.id)),
      }));
      state = await lerOffline(userId);
    }
    for (const pendente of state.comandos) {
      try {
        const { data } = await api.post(
          `/api/v1/motorista/saidas/${pendente.saidaId}/comandos`,
          pendente.comando,
        );
        await atualizarOffline(userId, (s) => ({
          ...s,
          comandos: s.comandos.filter((p) => p.comando.id !== pendente.comando.id),
          tarefas: s.tarefas
            ? { ...s.tarefas, ativa: data.status === "CONCLUIDA" ? null : data }
            : undefined,
        }));
      } catch (e) {
        await atualizarOffline(userId, (s) => ({
          ...s,
          comandos: s.comandos.map((p) =>
            p.comando.id === pendente.comando.id ? { ...p, erro: mensagemErro(e) } : p,
          ),
        }));
        throw e;
      }
    }
  };
  const promise = (
    navigator.locks ? navigator.locks.request(`rota-sync-${userId}`, work) : work()
  ).finally(() => running.delete(userId));
  running.set(userId, promise);
  return promise;
}
export async function carregarTarefas(userId: string) {
  const { data } = await api.get<Tarefas>("/api/v1/motorista/tarefas");
  await atualizarOffline(userId, (s) => ({ ...s, tarefas: data }));
  return data;
}
