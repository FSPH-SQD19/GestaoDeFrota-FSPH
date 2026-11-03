import { HttpError } from "../lib/http_error";
import { Request, Response } from "express";
import { cookieOptions, sessionCookieName } from "../middleware/session_http";
import { getAuthConfig } from "../config/auth";
import { login } from "../service/auth_s";

export async function loginController(req: Request, res: Response) {
  const { email, senha } = req.body ?? {};
  if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
    throw new HttpError(400, "Informe o e-mail e a senha.");
  }

  const resultado = await login({
    email: email.trim(),
    senha,
  });
  res.setHeader("Cache-Control", "no-store");
  res.cookie(sessionCookieName(), resultado.token, {
    ...cookieOptions(),
    maxAge: getAuthConfig().expiresIn * 1000,
  });
  return res.status(200).json({ usuario: resultado.usuario });
}
