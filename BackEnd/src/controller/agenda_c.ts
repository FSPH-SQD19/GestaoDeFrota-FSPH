import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { agendaSchema, consultarAgenda } from "../service/agenda_s";

export async function consultarAgendaController(req: Request, res: Response) {
  const periodo = validar(agendaSchema, req.query);
  res.set("Cache-Control", "no-store").json(await consultarAgenda(periodo));
}
