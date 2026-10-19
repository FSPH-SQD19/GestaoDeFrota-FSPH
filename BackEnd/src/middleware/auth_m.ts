
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface DadosAuth {
  userId: string;
  perfis: string[];
}

export function AuthToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const autorizacao = req.headers.authorization;

  if (!autorizacao || !autorizacao.startsWith("Bearer ")) {
    return res.status(401).json({
      mensagem: "Token de autenticação não fornecido"});
  }

  const token = autorizacao.split(" ")[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET não configurado.");
    return res.status(500).json({mensagem: "Erro interno de autenticação."});
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string" ||!decoded.sub ||!Array.isArray(decoded.perfis) ||!decoded.perfis.every((perfil) => typeof perfil === "string")) {
      return res.status(401).json({mensagem: "Token inválido"});
    }

    res.locals.auth = {
      userId: decoded.sub,
      perfis: decoded.perfis,
    } satisfies DadosAuth;

    next();


  } 
  catch {
    return res.status(401).json({
      mensagem: "Token inválido ou expirado.",
    });
  }
}
