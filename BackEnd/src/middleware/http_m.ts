import type { ErrorRequestHandler, RequestHandler } from "express";
import { verifyToken } from "../service/token_s";
import { resolveSession } from "../service/session_s";
import { readCookie, sessionCookieName } from "./session_http";
import { getAuthConfig } from "../config/auth";

export type ErroDetalhe = { campo: string; mensagem: string };

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: ErroDetalhe[] = [],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

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
    throw new HttpError(401, "Autenticação necessária.");
  }
  return usuario;
}

export const authenticate: RequestHandler = async (req, res, next) => {
  res.setHeader?.("Cache-Control", "no-store");
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i);
  const token = header ? match?.[1] : readCookie(req, sessionCookieName());
  if (!token) return next(new HttpError(401, "Autenticação necessária."));
  let secret: string;
  try {
    secret = getAuthConfig().secret;
  } catch {
    return next(new HttpError(500, "Configuração de autenticação inválida."));
  }
  let identity;
  try {
    identity = verifyToken(token, secret);
  } catch {
    return next(new HttpError(401, "Token inválido ou expirado."));
  }
  try {
    const usuario = await resolveSession(identity.usuarioId, identity.sessaoId);
    if (!usuario) return next(new HttpError(401, "Token inválido ou expirado."));
    res.locals.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...perfisPermitidos: string[]): RequestHandler {
  return (_req, res, next) => {
    const usuario = res.locals.usuario as UsuarioAutenticado | undefined;
    if (!usuario) {
      return next(new HttpError(401, "Autenticação necessária."));
    }
    if (!usuario.perfis.some((perfil) => perfisPermitidos.includes(perfil))) {
      return next(new HttpError(403, "Você não tem permissão para realizar esta operação."));
    }
    return next();
  };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    return res
      .status(error.statusCode)
      .json({ statusCode: error.statusCode, message: error.message, errors: error.errors });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ statusCode: 400, message: "JSON inválido.", errors: [] });
  }

  console.error(error);
  return res
    .status(500)
    .json({ statusCode: 500, message: "Erro interno do servidor.", errors: [] });
};
