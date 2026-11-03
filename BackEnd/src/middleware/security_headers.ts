import type { RequestHandler } from "express";
import { getWorkerRuntime } from "../config/runtime";

const isProduction = () => !!getWorkerRuntime() || process.env.NODE_ENV === "production";

/**
 * Cabeçalhos de segurança HTTP equivalentes ao Helmet para respostas da API REST,
 * compatíveis com Node.js (Express) e Cloudflare Workers sem dependências externas.
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );

  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};
