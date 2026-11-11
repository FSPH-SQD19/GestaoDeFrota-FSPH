import { validar } from "../lib/validar";
import type { Request, Response } from "express";
import { z } from "zod";
import { usuarioAutenticado } from "../middleware/http_m";
import { HttpError } from "../lib/http_error";
import {
  listarMinhasOrdensSvo,
  listarMinhasOrdensSvoSchema,
  criarChamadoSchema,
  criarOrdemSchema,
  avancarEtapaSchema,
  avancarEtapaColetaSvo,
  cancelarOrdemColetaSvo,
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

function validarId(id: string | undefined): string {
  if (!id || !z.uuid().safeParse(id).success) {
    throw new HttpError(
      400,
      "Não foi possível identificar o registro. Atualize a página e tente novamente.",
    );
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

export async function criarOrdemSvoController(req: Request, res: Response) {
  const { chamadoId, ...alocacao } = validar(criarOrdemSchema, req.body ?? {});
  const ordem = await emitirOrdemColetaSvo(chamadoId, alocacao, usuarioAutenticado(res).id);
  return res.status(201).json(ordem);
}

export async function avancarEtapaColetaSvoController(req: Request, res: Response) {
  const id = validarId(req.params.id as string | undefined);
  const { status } = validar(avancarEtapaSchema, req.body ?? {});
  return res.json(await avancarEtapaColetaSvo(id, status, usuarioAutenticado(res).id));
}

export async function cancelarOrdemSvoController(req: Request, res: Response) {
  return res.json(
    await cancelarOrdemColetaSvo(
      validarId(req.params.id as string | undefined),
      usuarioAutenticado(res).id,
    ),
  );
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

export async function listarMinhasOrdensSvoController(req: Request, res: Response) {
  return res.json(
    await listarMinhasOrdensSvo(
      usuarioAutenticado(res).id,
      validar(listarMinhasOrdensSvoSchema, req.query),
    ),
  );
}
