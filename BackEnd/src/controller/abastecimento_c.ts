import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  listarAbastecimentos,
  listarAbastecimentosSchema,
  criarAbastecimento,
  criarAbastecimentoSchema,
  criarAbastecimentoMotorista,
  criarAbastecimentoMotoristaSchema,
  listarMeusAbastecimentos,
} from "../service/abastecimento_s";

export async function listarAbastecimentosController(req: Request, res: Response) {
  const filtros = validar(listarAbastecimentosSchema, req.query);
  const resultado = await listarAbastecimentos(filtros);
  return res.status(200).json(resultado);
}

export async function criarAbastecimentoController(req: Request, res: Response) {
  const usuario = usuarioAutenticado(res);
  if (!usuario.perfis.some((perfil) => perfil === "ADMIN" || perfil === "GESTOR")) {
    const dados = validar(criarAbastecimentoMotoristaSchema, req.body ?? {});
    return res.status(201).json(await criarAbastecimentoMotorista(dados, usuario.id));
  }
  const dados = validar(criarAbastecimentoSchema, req.body ?? {});
  const abastecimento = await criarAbastecimento(dados, usuario.id);
  return res.status(201).json(abastecimento);
}

export async function listarMeusAbastecimentosController(req: Request, res: Response) {
  const filtros = validar(listarAbastecimentosSchema, req.query);
  return res.status(200).json(await listarMeusAbastecimentos(filtros, usuarioAutenticado(res).id));
}
