import { getWorkerRuntime } from "../config/runtime";
import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;

async function consume(scope: string, value: string, limit: number) {
  const key = createHash("sha256").update(`${scope}:${value}`).digest("hex");
  const rows = await prisma.$queryRaw<{ tentativas: number; expira_em: Date }[]>`
    INSERT INTO auth_login_limites (chave, tentativas, expira_em)
    VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE WHEN auth_login_limites.expira_em <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST(auth_login_limites.tentativas + 1, 1000000) END,
      expira_em = CASE WHEN auth_login_limites.expira_em <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE auth_login_limites.expira_em END
    RETURNING tentativas, expira_em`;
  return rows[0].tentativas > limit;
}

export const limitLogin: RequestHandler = async (req, res, next) => {
  try {
    // Persistência compartilhada no Neon: reinícios e réplicas não zeram o limite.
    const ipBlocked = await consume(
      "ip",
      getWorkerRuntime()?.clientIp || req.ip || req.socket.remoteAddress || "unknown",
      30,
    );
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    const accountBlocked = email ? await consume("account", email, 10) : false;
    if (ipBlocked || accountBlocked) {
      res.setHeader("Retry-After", String(WINDOW_MS / 1000));
      res.status(429).json({ error: "Muitas tentativas. Tente novamente em 15 minutos." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
