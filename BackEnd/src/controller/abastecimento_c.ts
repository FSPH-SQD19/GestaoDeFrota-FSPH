import type { Request, Response } from "express";
import { validar } from "./veiculo_c";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  listarAbastecimentos,
  listarAbastecimentosSchema,
  criarAbastecimento,
  criarAbastecimentoSchema,
} from "../service/abastecimento_s";

export async function listarAbastecimentosController(req: Request, res: Response) {
  const filtros = validar(listarAbastecimentosSchema, req.query);
  const resultado = await listarAbastecimentos(filtros);
  return res.status(200).json(resultado);
}

export async function criarAbastecimentoController(req: Request, res: Response) {
  const dados = validar(criarAbastecimentoSchema, req.body ?? {});
  const abastecimento = await criarAbastecimento(dados, usuarioAutenticado(res).id);
  return res.status(201).json(abastecimento);
}
