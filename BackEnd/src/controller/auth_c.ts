import { Request, Response } from "express";
import { cookieOptions, sessionCookieName } from "../middleware/session_http";
import { getAuthConfig } from "../config/auth";
import { login } from "../service/auth_s";

export async function loginController(req: Request, res: Response) {
  try {
    const { email, senha } = req.body ?? {};
    if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
      return res.status(400).json({ error: "email e senha são obrigatórios" });
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
  } catch (error) {
    if (error instanceof Error && error.message === "Credenciais inválidas") {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    console.error("Falha interna na autenticação.");
    return res.status(500).json({ mensagem: "Erro interno ao realizar login." });
  }
}
