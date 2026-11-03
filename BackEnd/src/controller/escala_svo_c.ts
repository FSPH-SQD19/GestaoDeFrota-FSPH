import type { Request, Response } from "express";
import { z } from "zod";
import { validar } from "./veiculo_c";
import { HttpError, usuarioAutenticado } from "../middleware/http_m";
import {
  criarEscalaSvo,
  criarEscalaSvoSchema,
  encerrarEscalaSvo,
  listarEscalasSvo,
  listarEscalasSvoSchema,
} from "../service/escala_svo_s";

function validarId(id: unknown): string {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    throw new HttpError(400, "ID da escala inválido.", [
      { campo: "id", mensagem: "Informe um UUID válido." },
    ]);
  }
  return id;
}

export async function listarEscalasSvoController(req: Request, res: Response) {
  return res.json(await listarEscalasSvo(validar(listarEscalasSvoSchema, req.query)));
}

export async function criarEscalaSvoController(req: Request, res: Response) {
  const escala = await criarEscalaSvo(
    validar(criarEscalaSvoSchema, req.body ?? {}),
    usuarioAutenticado(res).id,
  );
  return res.status(201).json(escala);
}

export async function encerrarEscalaSvoController(req: Request, res: Response) {
  const escala = await encerrarEscalaSvo(validarId(req.params.id), usuarioAutenticado(res).id);
  return res.json(escala);
}
