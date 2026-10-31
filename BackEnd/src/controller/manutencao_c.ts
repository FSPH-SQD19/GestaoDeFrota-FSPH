import type { Request, Response } from "express";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  concluirManutencao,
  criarManutencao,
  criarManutencaoSchema,
  listarManutencoes,
  listarManutencoesSchema,
  manutencaoIdSchema,
} from "../service/manutencao_s";
import { validar } from "./veiculo_c";

export async function listarManutencoesController(req: Request, res: Response) {
  const filtros = validar(listarManutencoesSchema, req.query);
  return res.status(200).json(await listarManutencoes(filtros));
}

export async function criarManutencaoController(req: Request, res: Response) {
  const dados = validar(criarManutencaoSchema, req.body ?? {});
  const manutencao = await criarManutencao(dados, usuarioAutenticado(res).id);
  return res.status(201).json(manutencao);
}

export async function concluirManutencaoController(req: Request, res: Response) {
  const { id } = validar(manutencaoIdSchema, req.params);
  const resultado = await concluirManutencao(id, usuarioAutenticado(res).id);
  return res.status(200).json(resultado);
}
