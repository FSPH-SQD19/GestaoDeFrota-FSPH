import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError, usuarioAutenticado } from "../middleware/http_m";
import {
  criarChamadoSchema,
  emitirOrdemSchema,
  listarChamadosSchema,
  triagemSchema,
  indicadoresSvo,
  listarChamadosSvo,
  registrarChamadoSvo,
  realizarTriagemSvo,
  emitirOrdemColetaSvo,
  concluirColetaSvo,
  concluirDesinfeccaoSvo,
  listarViaturasSvo,
  listarMotoristasSvoDisponiveis,
} from "../service/svo_s";

function validar<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "Dados inválidos.",
      parsed.error.issues.map((issue) => ({
        campo: issue.path.join("."),
        mensagem: issue.message,
      })),
    );
  }
  return parsed.data;
}

function validarId(id: string | undefined): string {
  if (!id || !z.uuid().safeParse(id).success) {
    throw new HttpError(400, "ID inválido.");
  }
  return id;
}

export async function indicadoresSvoController(_req: Request, res: Response) {
  return res.json(await indicadoresSvo());
}

export async function listarChamadosSvoController(req: Request, res: Response) {
  return res.json(await listarChamadosSvo(validar(listarChamadosSchema, req.query)));
}

export async function registrarChamadoSvoController(req: Request, res: Response) {
  const result = await registrarChamadoSvo(
    validar(criarChamadoSchema, req.body ?? {}),
    usuarioAutenticado(res).id,
  );
  return res.status(201).json(result);
}

export async function triagemSvoController(req: Request, res: Response) {
  return res.json(
    await realizarTriagemSvo(
      validarId(req.params.id as string | undefined),
      validar(triagemSchema, req.body ?? {}),
      usuarioAutenticado(res).id,
    ),
  );
}

export async function emitirOrdemSvoController(req: Request, res: Response) {
  const result = await emitirOrdemColetaSvo(
    validarId(req.params.id as string | undefined),
    validar(emitirOrdemSchema, req.body ?? {}),
    usuarioAutenticado(res).id,
  );
  return res.status(201).json(result);
}

export async function concluirColetaSvoController(req: Request, res: Response) {
  const result = await concluirColetaSvo(
    validarId(req.params.id as string | undefined),
    usuarioAutenticado(res).id,
  );
  return res.json(result);
}

export async function concluirDesinfeccaoSvoController(req: Request, res: Response) {
  const result = await concluirDesinfeccaoSvo(
    validarId(req.params.id as string | undefined),
    usuarioAutenticado(res).id,
  );
  return res.json(result);
}

export async function listarViaturasSvoController(_req: Request, res: Response) {
  return res.json(await listarViaturasSvo());
}

export async function listarMotoristasSvoController(_req: Request, res: Response) {
  return res.json(await listarMotoristasSvoDisponiveis());
}
