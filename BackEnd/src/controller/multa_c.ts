import type { Request, Response } from "express";
import { z } from "zod";
import { usuarioAutenticado } from "../middleware/http_m";
import { validar } from "../lib/validar";
import {
  atualizarMulta,
  atualizarMultaSchema,
  criarMulta,
  criarMultaSchema,
  listarMultas,
  listarMultasSchema,
  obterMultaPorId,
  obterResumoMultasMotorista,
} from "../service/multa_s";

const idParamSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

const motoristaIdParamSchema = z.object({
  motoristaId: z.string().uuid("Identificador do motorista inválido."),
});

export async function listarMultasController(req: Request, res: Response) {
  const filtros = validar(listarMultasSchema, req.query);
  const resultado = await listarMultas(filtros);
  return res.status(200).json(resultado);
}

export async function obterMultaController(req: Request, res: Response) {
  const { id } = validar(idParamSchema, req.params);
  const multa = await obterMultaPorId(id);
  return res.status(200).json(multa);
}

export async function criarMultaController(req: Request, res: Response) {
  const dados = validar(criarMultaSchema, req.body ?? {});
  const usuario = usuarioAutenticado(res);
  const multa = await criarMulta(dados, usuario?.id);
  return res.status(201).json(multa);
}

export async function atualizarMultaController(req: Request, res: Response) {
  const { id } = validar(idParamSchema, req.params);
  const dados = validar(atualizarMultaSchema, req.body ?? {});
  const usuario = usuarioAutenticado(res);
  const multa = await atualizarMulta(id, dados, usuario?.id);
  return res.status(200).json(multa);
}

export async function resumoMultasMotoristaController(req: Request, res: Response) {
  const { motoristaId } = validar(motoristaIdParamSchema, req.params);
  const resumo = await obterResumoMultasMotorista(motoristaId);
  return res.status(200).json(resumo);
}
