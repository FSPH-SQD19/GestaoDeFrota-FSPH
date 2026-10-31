export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const BROWSER_SESSION_KEY = "@fsph_frota_session_activity";
const CHANGE_EVENT = "frota-session-change";
type BrowserSession = { status: "active" | "pending" | "ended"; lastActivity: number };
let fallback: BrowserSession | null = null;

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
  save({ status: pending ? "pending" : "ended", lastActivity: Date.now() });
}
export function browserSessionExpired() {
  const value = readBrowserSession();
  return (
    !!value && (value.status !== "active" || Date.now() - value.lastActivity >= IDLE_TIMEOUT_MS)
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
    const remaining = value ? IDLE_TIMEOUT_MS - (Date.now() - value.lastActivity) : IDLE_TIMEOUT_MS;
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
