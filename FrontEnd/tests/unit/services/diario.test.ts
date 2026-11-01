import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { distanciaDaRota, estadoPosicao } from "../../../src/features/motorista/geo";
import {
  confirmarSaidaSessao,
  limparSaidaSessao,
  startBrowserSession,
  watchBrowserSession,
  browserSessionExpired,
  IDLE_TIMEOUT_MS,
} from "../../../src/services/browserSession";
describe("GPS e atualização", () => {
  it("mede desvio em metros sem tratar coordenadas como metros", () => {
    expect(
      distanciaDaRota(
        [-37, -10],
        [
          [-37, -10.01],
          [-37, -9.99],
        ],
      ),
    ).toBeLessThan(1);
    expect(
      distanciaDaRota(
        [-36.999, -10],
        [
          [-37, -10.01],
          [-37, -9.99],
        ],
      ),
    ).toBeGreaterThan(100);
  });
  it("distingue posição atual, atrasada e sem atualização", () => {
    const now = Date.now();
    expect(estadoPosicao(new Date(now).toISOString(), now)).toBe("Atualizada");
    expect(estadoPosicao(new Date(now - 30000).toISOString(), now)).toBe("Posição desatualizada");
    expect(estadoPosicao(new Date(now - 120000).toISOString(), now)).toBe("Sem atualização");
  });
});
describe("sessão durante saída", () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    limparSaidaSessao();
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });
  it("mantém saída confirmada offline, mas expira no limite absoluto", () => {
    startBrowserSession();
    confirmarSaidaSessao("u", "s", new Date(Date.now() + 8 * 3600000).toISOString());
    const expire = vi.fn();
    stop = watchBrowserSession(expire, vi.fn());
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1);
    expect(expire).not.toHaveBeenCalled();
    expect(browserSessionExpired()).toBe(false);
    vi.advanceTimersByTime(8 * 3600000 - IDLE_TIMEOUT_MS);
    expect(expire).toHaveBeenCalledOnce();
    expect(browserSessionExpired()).toBe(true);
  });
  it("não renova por posições sem revalidação da saída", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    startBrowserSession();
    confirmarSaidaSessao("u", "s", new Date(Date.now() + 8 * 3600000).toISOString());
    const expire = vi.fn();
    stop = watchBrowserSession(expire, vi.fn());
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(expire).toHaveBeenCalledOnce();
  });
});
