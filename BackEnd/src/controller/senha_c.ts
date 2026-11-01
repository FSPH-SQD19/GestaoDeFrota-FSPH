import type { NextFunction, Request, Response } from "express";
import { usuarioAutenticado } from "../middleware/http_m";
import { alterarMinhaSenha, redefinirSenhaPorAdmin } from "../service/senha_s";

export async function alterarSenhaController(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = usuarioAutenticado(res);
    const { senhaAtual, novaSenha } = req.body ?? {};
    await alterarMinhaSenha({
      usuarioId: usuario.id,
      sessaoId: usuario.sessaoId,
      senhaAtual,
      novaSenha,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ mensagem: "Senha alterada com sucesso." });
  } catch (error) {
    return next(error);
  }
}

export async function redefinirSenhaAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const admin = usuarioAutenticado(res);
    const usuarioAlvoId = String(req.params.id ?? "");
    const { novaSenha } = req.body ?? {};
    await redefinirSenhaPorAdmin({
      adminId: admin.id,
      sessaoAdminId: admin.sessaoId,
      usuarioAlvoId,
      novaSenha,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ mensagem: "Senha redefinida com sucesso." });
  } catch (error) {
    return next(error);
  }
}
