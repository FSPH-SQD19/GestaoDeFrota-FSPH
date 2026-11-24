import type { Request, Response } from "express";
import { z } from "zod";
import { validar } from "../lib/validar";
import { HttpError } from "../lib/http_error";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  filaTriagemSchema,
  listarFilaTriagemExterna,
  obterSolicitacaoExternaTriagem,
  triagemExternaSchema,
  triarSolicitacaoExterna,
} from "../service/fluxo_externo_svo_s";

function validarId(id: string | undefined): string {
  if (!id || !z.uuid().safeParse(id).success) {
    throw new HttpError(
      400,
      "Não foi possível identificar a solicitação. Atualize a página e tente novamente.",
    );
  }
  return id;
}

export async function listarFilaTriagemExternaController(req: Request, res: Response) {
  return res.json(await listarFilaTriagemExterna(validar(filaTriagemSchema, req.query)));
}

export async function obterSolicitacaoExternaTriagemController(req: Request, res: Response) {
  return res.json(await obterSolicitacaoExternaTriagem(validarId(req.params.id as string)));
}

export async function triarSolicitacaoExternaController(req: Request, res: Response) {
  const id = validarId(req.params.id as string);
  return res.json(
    await triarSolicitacaoExterna(
      id,
      validar(triagemExternaSchema, req.body ?? {}),
      usuarioAutenticado(res),
    ),
  );
}
