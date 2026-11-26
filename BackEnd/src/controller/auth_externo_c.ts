import type { Request, Response } from "express";
import { getAuthConfig } from "../config/auth";
import { usuarioAutenticado } from "../middleware/http_m";
import { cookieOptions, sessionCookieName } from "../middleware/session_http";
import { cadastrarUsuarioExterno, obterMeuPerfilExterno } from "../service/auth_externo_s";

export async function cadastrarUsuarioExternoController(req: Request, res: Response) {
  const resultado = await cadastrarUsuarioExterno(req.body ?? {});
  res.setHeader("Cache-Control", "no-store");
  res.cookie(sessionCookieName(), resultado.token, {
    ...cookieOptions(),
    maxAge: getAuthConfig().expiresIn * 1000,
  });
  return res.status(201).json({ usuario: resultado.usuario });
}

export async function obterMeuPerfilExternoController(_req: Request, res: Response) {
  const usuario = await obterMeuPerfilExterno(usuarioAutenticado(res));
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ usuario });
}
