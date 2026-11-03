import type { Request, Response } from "express";
import { usuarioAutenticado } from "../middleware/http_m";
import { obterResumoDashboard } from "../service/dashboard_s";

export async function resumoDashboardController(_req: Request, res: Response) {
  return res.json(await obterResumoDashboard(usuarioAutenticado(res)));
}
