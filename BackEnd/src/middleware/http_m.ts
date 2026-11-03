import { HttpError } from "../lib/http_error";
import type { RequestHandler } from "express";
import { verifyToken } from "../service/token_s";
import { resolveSession } from "../service/session_s";
import { readCookie, sessionCookieName } from "./session_http";
import { getAuthConfig } from "../config/auth";

export type UsuarioAutenticado = {
  id: string;
  perfis: string[];
  nome?: string;
  email?: string;
  sessaoId?: string;
};

export function usuarioAutenticado(res: { locals: Record<string, unknown> }): UsuarioAutenticado {
  const usuario = res.locals.usuario as UsuarioAutenticado | undefined;
  if (!usuario) {
    throw new HttpError(401, "Entre no sistema para continuar.");
  }
  return usuario;
}

export const authenticate: RequestHandler = async (req, res, next) => {
  res.setHeader?.("Cache-Control", "no-store");
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i);
  const token = header ? match?.[1] : readCookie(req, sessionCookieName());
  if (!token) return next(new HttpError(401, "Entre no sistema para continuar."));
  const { secret } = getAuthConfig();
  let identity;
  try {
    identity = verifyToken(token, secret);
  } catch {
    return next(new HttpError(401, "Sua sessão expirou. Entre novamente."));
  }
  const usuario = await resolveSession(identity.usuarioId, identity.sessaoId);
  if (!usuario) return next(new HttpError(401, "Sua sessão expirou. Entre novamente."));
  res.locals.usuario = usuario;
  next();
};

export function requireRole(...perfisPermitidos: string[]): RequestHandler {
  return (_req, res, next) => {
    const usuario = res.locals.usuario as UsuarioAutenticado | undefined;
    if (!usuario) {
      return next(new HttpError(401, "Entre no sistema para continuar."));
    }
    if (!usuario.perfis.some((perfil) => perfisPermitidos.includes(perfil))) {
      return next(new HttpError(403, "Você não tem permissão para realizar esta operação."));
    }
    return next();
  };
}
