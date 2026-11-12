import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { listarAuditoria, listarAuditoriaSchema } from "../service/auditoria_s";

export async function listarAuditoriaController(req: Request, res: Response) {
  const filtros = validar(listarAuditoriaSchema, req.query);
  const resultado = await listarAuditoria(filtros);

  return res.status(200).json(resultado);
}
