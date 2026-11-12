import type { Request, Response } from "express";
import { z } from "zod";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  analisarAvaria,
  analisarAvariaSchema,
  historicoAvaria,
  listarAvarias,
  listarAvariasSchema,
  listarVeiculosComAvaria,
} from "../service/avaria_s";

export async function listarAvariasController(req: Request, res: Response) {
  const filtros = validar(listarAvariasSchema, req.query);
  return res.status(200).json(await listarAvarias(filtros));
}

export async function listarVeiculosComAvariaController(_req: Request, res: Response) {
  return res.status(200).json({ data: await listarVeiculosComAvaria() });
}

export async function historicoAvariaController(req: Request, res: Response) {
  const id = validar(z.uuid(), req.params.id);
  return res.status(200).json({ data: await historicoAvaria(id) });
}

export async function analisarAvariaController(req: Request, res: Response) {
  const id = validar(z.uuid(), req.params.id);
  const dados = validar(analisarAvariaSchema, req.body ?? {});
  return res.status(200).json(await analisarAvaria(id, dados, usuarioAutenticado(res).id));
}
