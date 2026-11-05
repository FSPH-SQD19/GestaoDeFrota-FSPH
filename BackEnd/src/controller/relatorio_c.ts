import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { gerarRelatorio, periodoRelatorioSchema } from "../service/relatorio_s";

export async function gerarRelatorioOperacionalController(req: Request, res: Response) {
  const periodo = validar(periodoRelatorioSchema, req.query);
  const relatorio = await gerarRelatorio(periodo);

  return res.status(200).json(relatorio);
}
