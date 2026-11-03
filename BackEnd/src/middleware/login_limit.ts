import { getWorkerRuntime } from "../config/runtime";
import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import type { UsuarioAutenticado } from "./http_m";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PASSWORD_FAILURES = 10;

function scopeKey(scope: string, value: string) {
  return createHash("sha256").update(`${scope}:${value}`).digest("hex");
}

async function consume(scope: string, value: string, limit: number) {
  const key = scopeKey(scope, value);
  const rows = await prisma.$queryRaw<{ tentativas: number; expira_em: Date }[]>`
    INSERT INTO auth_login_limites (chave, tentativas, expira_em)
    VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE WHEN auth_login_limites.expira_em <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST(auth_login_limites.tentativas + 1, 1000000) END,
      expira_em = CASE WHEN auth_login_limites.expira_em <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE auth_login_limites.expira_em END
    RETURNING tentativas, expira_em`;
  return rows[0].tentativas > limit;
}

export async function recordPasswordChangeFailure(usuarioId: string): Promise<void> {
  await consume("pwd-user", usuarioId, MAX_PASSWORD_FAILURES);
}

export async function clearPasswordChangeFailures(usuarioId: string): Promise<void> {
  const key = scopeKey("pwd-user", usuarioId);
  await prisma.$queryRaw<{ tentativas: number; expira_em: Date }[]>`
    DELETE FROM auth_login_limites
    WHERE chave = ${key}
    RETURNING tentativas, expira_em`;
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

export const limitPasswordChange: RequestHandler = async (_req, res, next) => {
  try {
    const usuario = res.locals.usuario as UsuarioAutenticado | undefined;
    if (!usuario?.id) {
      next();
      return;
    }
    const key = scopeKey("pwd-user", usuario.id);
    const rows = await prisma.$queryRaw<{ tentativas: number; expira_em: Date }[]>`
      SELECT tentativas, expira_em
      FROM auth_login_limites
      WHERE chave = ${key} AND expira_em > CURRENT_TIMESTAMP`;
    if ((rows[0]?.tentativas ?? 0) >= MAX_PASSWORD_FAILURES) {
      res.setHeader("Retry-After", String(WINDOW_MS / 1000));
      res.status(429).json({
        message:
          "Muitas tentativas inválidas de alteração de senha. Tente novamente em 15 minutos.",
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
