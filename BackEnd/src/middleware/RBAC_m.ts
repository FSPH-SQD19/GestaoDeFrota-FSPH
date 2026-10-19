import { Request, Response, NextFunction } from "express";
import { DadosAuth } from "./auth_m";

export function autorizarPerfis(...perfisPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = res.locals.auth as DadosAuth | undefined;

    if (!auth) {
      return res.status(401).json({mensagem: "Autenticação necessária."});
    }

    const autorizado = auth.perfis.some((perfil) =>perfisPermitidos.includes(perfil));

    if (!autorizado) {
      return res.status(403).json({mensagem: "Você não tem permissão para acessar este recurso."});
    }

    next();
  };
}