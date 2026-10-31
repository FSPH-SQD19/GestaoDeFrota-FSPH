import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_SESSION_KEY,
  IDLE_TIMEOUT_MS,
  browserSessionExpired,
  markBrowserLogout,
  readBrowserSession,
  startBrowserSession,
  watchBrowserSession,
} from "../../../src/services/browserSession";
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
});
describe("timer de inatividade no navegador", () => {
  it("encerra aos 30 minutos sem interação, uma única vez", () => {
    const expired = vi.fn();
    dispose = watchBrowserSession(expired, vi.fn());
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(expired).toHaveBeenCalledOnce();
  });
  it("reinicia o prazo quando o usuário interage", () => {
    const expired = vi.fn();
    dispose = watchBrowserSession(expired, vi.fn());
    vi.advanceTimersByTime(29 * 60_000);
    window.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(29 * 60_000);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(expired).toHaveBeenCalledOnce();
  });
  it("não reinicia o prazo ao recarregar ou montar novamente", () => {
    const expired = vi.fn();
    dispose = watchBrowserSession(expired, vi.fn());
    vi.advanceTimersByTime(20 * 60_000);
    dispose();
    dispose = watchBrowserSession(expired, vi.fn());
    vi.advanceTimersByTime(10 * 60_000);
    expect(expired).toHaveBeenCalledOnce();
  });
  it("confere o relógio ao voltar de suspensão antes de renovar por atividade", () => {
    const expired = vi.fn();
    dispose = watchBrowserSession(expired, vi.fn());
    vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + 1);
    window.dispatchEvent(new Event("focus"));
    expect(expired).toHaveBeenCalledOnce();
    expect(browserSessionExpired()).toBe(true);
  });
  it("acompanha atividade e logout de outra aba", () => {
    const ended = vi.fn();
    const expired = vi.fn();
    dispose = watchBrowserSession(expired, ended);
    vi.advanceTimersByTime(29 * 60_000);
    localStorage.setItem(
      BROWSER_SESSION_KEY,
      JSON.stringify({ status: "active", lastActivity: Date.now() }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: BROWSER_SESSION_KEY }));
    vi.advanceTimersByTime(2 * 60_000);
    expect(expired).not.toHaveBeenCalled();
    markBrowserLogout(false);
    expect(ended).toHaveBeenCalledOnce();
  });
  it("persiste saída pendente sem armazenar credenciais", () => {
    startBrowserSession();
    markBrowserLogout(true);
    expect(readBrowserSession()).toEqual({ status: "pending", lastActivity: Date.now() });
    expect(Object.keys(JSON.parse(localStorage.getItem(BROWSER_SESSION_KEY)!))).toEqual([
      "status",
      "lastActivity",
    ]);
  });
});
