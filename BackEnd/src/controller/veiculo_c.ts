import { validar } from "../lib/validar";
import type { Request, Response } from "express";
import { usuarioAutenticado } from "../middleware/http_m";
import { HttpError } from "../lib/http_error";
import {
  atualizarVeiculo,
  atualizarVeiculoSchema,
  criarVeiculo,
  criarVeiculoSchema,
  listarVeiculos,
  listarVeiculosSchema,
} from "../service/veiculo_s";

export async function listarVeiculosController(req: Request, res: Response) {
  const filtros = validar(listarVeiculosSchema, req.query);
  const resultado = await listarVeiculos(filtros);
  return res.status(200).json(resultado);
}

export async function criarVeiculoController(req: Request, res: Response) {
  const dados = validar(criarVeiculoSchema, req.body ?? {});
  const veiculo = await criarVeiculo(dados, usuarioAutenticado(res).id);
  return res.status(201).location(`/api/v1/veiculos/${veiculo.id}`).json(veiculo);
}
export async function atualizarVeiculoController(req: Request, res: Response) {
  const id = req.params.id;

  if (typeof id !== "string" || !id) {
    throw new HttpError(400, "Selecione um veículo e tente novamente.");
  }

  const dados = validar(atualizarVeiculoSchema, req.body ?? {});

  const veiculo = await atualizarVeiculo(id, dados, usuarioAutenticado(res).id);

  return res.status(200).json(veiculo);
}
