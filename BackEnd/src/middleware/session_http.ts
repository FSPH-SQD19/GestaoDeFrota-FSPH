import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, RequestHandler } from "express";
import { getAuthConfig } from "../config/auth";

const production = () => process.env.NODE_ENV === "production";
export const sessionCookieName = () => (production() ? "__Host-frota_session" : "frota_session");
const csrfCookieName = () => (production() ? "__Host-frota_csrf" : "frota_csrf");
export const cookieOptions = () => ({
  httpOnly: true,
  secure: production(),
  sameSite: "lax" as const,
  path: "/",
});

export function allowedOrigins() {
  const configured = process.env.APP_ORIGINS;
  if (production() && !configured) throw new Error("APP_ORIGINS é obrigatória em produção.");
  const origins = (
    configured ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
  )
    .split(",")
    .map((x) => x.trim());
  if (
    origins.some((x) => {
      try {
        const u = new URL(x);
        return (
          u.origin !== x ||
          (production() && u.protocol !== "https:") ||
          !["http:", "https:"].includes(u.protocol)
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error("APP_ORIGINS deve conter origens explícitas (HTTPS em produção).");
  return origins;
}

export function readCookie(req: Request, name: string) {
  const values = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;
  try {
    return decodeURIComponent(values[0].slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function csrfSignature(nonce: string, req: Request) {
  return createHmac("sha256", getAuthConfig().secret)
    .update(`csrf:${nonce}:${readCookie(req, sessionCookieName()) || "anonymous"}`)
    .digest("hex");
}

export function issueCsrf(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const existing = readCookie(req, csrfCookieName());
  let nonce = existing?.split(".")[0];
  if (
    !nonce ||
    !existing ||
    !/^[a-f0-9]{64}$/.test(nonce) ||
    !equal(existing, `${nonce}.${csrfSignature(nonce, req)}`)
  )
    nonce = randomBytes(32).toString("hex");
  res.cookie(csrfCookieName(), `${nonce}.${csrfSignature(nonce, req)}`, {
    ...cookieOptions(),
    maxAge: 8 * 60 * 60 * 1000,
  });
  return res.json({ csrfToken: nonce });
}

export const protectRequests: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins().includes(origin)) {
    res.status(403).json({ message: "Origem não autorizada." });
    return;
  }
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // Clientes de API com Bearer não usam credenciais anexadas automaticamente.
  const authEndpoint = /\/auth\/(login|logout)\/?$/i.test(req.path);
  if (!authEndpoint && !readCookie(req, sessionCookieName())) return next();
  const nonce = req.headers["x-csrf-token"];
  const cookie = readCookie(req, csrfCookieName());
  if (
    typeof nonce !== "string" ||
    !/^[a-f0-9]{64}$/.test(nonce) ||
    !cookie ||
    !equal(cookie, `${nonce}.${csrfSignature(nonce, req)}`)
  ) {
    res.status(403).json({ message: "Proteção CSRF inválida. Recarregue a página." });
    return;
  }
  next();
};
