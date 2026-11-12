export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const BROWSER_SESSION_KEY = "@fsph_frota_session_activity";
const CHANGE_EVENT = "frota-session-change";
type BrowserSession = { status: "active" | "pending" | "ended"; lastActivity: number };
let fallback: BrowserSession | null = null;
const SAIDA_SESSION_KEY = "@fsph_frota_saida_session";
export function confirmarSaidaSessao(userId: string, saidaId: string, expiraEm: string) {
  const expiresAt = Date.parse(expiraEm);
  if (!Number.isFinite(expiresAt)) return;
  try {
    localStorage.setItem(
      SAIDA_SESSION_KEY,
      JSON.stringify({ userId, saidaId, expiresAt, confirmedAt: Date.now() }),
    );
  } catch {
    /* unavailable */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function usuarioSaidaOffline(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(SAIDA_SESSION_KEY) || "null");
    return value && Date.now() < value.expiresAt ? value.userId : null;
  } catch {
    return null;
  }
}
export function limparSaidaSessao() {
  try {
    localStorage.removeItem(SAIDA_SESSION_KEY);
  } catch {
    /* unavailable */
  }
}
function saidaDeadline() {
  try {
    const value = JSON.parse(localStorage.getItem(SAIDA_SESSION_KEY) || "null");
    return typeof value?.expiresAt === "number" ? value.expiresAt : Infinity;
  } catch {
    return Infinity;
  }
}
function saidaSessionRemaining() {
  if (document.visibilityState !== "visible") return 0;
  try {
    const value = JSON.parse(localStorage.getItem(SAIDA_SESSION_KEY) || "null") as {
      expiresAt: number;
      confirmedAt: number;
      visible?: boolean;
    } | null;
    if (
      !value ||
      value.visible === false ||
      !Number.isFinite(value.expiresAt) ||
      !Number.isFinite(value.confirmedAt)
    )
      return 0;
    return Math.max(
      0,
      Math.min(
        value.expiresAt - Date.now(),
        navigator.onLine ? value.confirmedAt + 120000 - Date.now() : Infinity,
      ),
    );
  } catch {
    return 0;
  }
}

export function readBrowserSession(): BrowserSession | null {
  try {
    const raw = localStorage.getItem(BROWSER_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BrowserSession>;
    if (
      !["active", "pending", "ended"].includes(value.status || "") ||
      typeof value.lastActivity !== "number" ||
      !Number.isFinite(value.lastActivity)
    )
      return null;
    return value as BrowserSession;
  } catch {
    return fallback;
  }
}
function save(value: BrowserSession) {
  fallback = value;
  try {
    localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(value));
  } catch {
    /* Timer em memória quando o armazenamento não está disponível. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function startBrowserSession() {
  save({ status: "active", lastActivity: Date.now() });
}
export function markBrowserLogout(pending: boolean) {
  limparSaidaSessao();
  save({ status: pending ? "pending" : "ended", lastActivity: Date.now() });
}
export function browserSessionExpired() {
  const value = readBrowserSession();
  return (
    Date.now() >= saidaDeadline() ||
    (!!value &&
      (value.status !== "active" ||
        (Date.now() - value.lastActivity >= IDLE_TIMEOUT_MS && saidaSessionRemaining() <= 0)))
  );
}

// Somente horário e estado da saída são compartilhados entre abas. Não há token ou senha aqui.
export function watchBrowserSession(onExpire: () => void, onEnded: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const check = () => {
    if (stopped) return;
    clearTimeout(timer);
    const value = readBrowserSession();
    if (value && value.status !== "active") {
      stopped = true;
      if (value.status === "pending") onExpire();
      else onEnded();
      return;
    }
    const remaining = Math.min(
      saidaDeadline() - Date.now(),
      Math.max(
        value ? IDLE_TIMEOUT_MS - (Date.now() - value.lastActivity) : IDLE_TIMEOUT_MS,
        saidaSessionRemaining(),
      ),
    );
    if (remaining <= 0) {
      stopped = true;
      onExpire();
      return;
    }
    timer = setTimeout(check, remaining);
  };
  const activity = () => {
    check(); // Suspensão/aba em segundo plano não pode renovar uma sessão que já venceu.
    if (stopped) return;
    const previous = readBrowserSession();
    if (!previous || Date.now() - previous.lastActivity >= 1000) startBrowserSession();
  };
  const visibility = () => {
    if (document.visibilityState === "visible") activity();
    else {
      try {
        const raw = localStorage.getItem(SAIDA_SESSION_KEY);
        if (raw) {
          const value = JSON.parse(raw);
          localStorage.setItem(SAIDA_SESSION_KEY, JSON.stringify({ ...value, visible: false }));
        }
      } catch {
        /* unavailable */
      }
      check();
    }
  };
  const storage = (event: StorageEvent) => {
    if (event.key === BROWSER_SESSION_KEY || event.key === null) check();
  };
  const events = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;
  for (const event of events)
    window.addEventListener(event, activity, { passive: true, capture: true });
  window.addEventListener("focus", activity);
  window.addEventListener("storage", storage);
  window.addEventListener(CHANGE_EVENT, check);
  document.addEventListener("visibilitychange", visibility);
  if (!readBrowserSession()) startBrowserSession();
  check();
  return () => {
    stopped = true;
    clearTimeout(timer);
    for (const event of events) window.removeEventListener(event, activity, true);
    window.removeEventListener("focus", activity);
    window.removeEventListener("storage", storage);
    window.removeEventListener(CHANGE_EVENT, check);
    document.removeEventListener("visibilitychange", visibility);
  };
}
