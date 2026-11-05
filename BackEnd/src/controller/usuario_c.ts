import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  atualizarUsuario,
  atualizarUsuarioSchema,
  criarUsuario,
  criarUsuarioSchema,
  inativarUsuario,
  listarUsuarios,
  listarUsuariosSchema,
  obterUsuario,
} from "../service/usuario_s";

export async function listarUsuariosController(req: Request, res: Response) {
  const filtros = validar(listarUsuariosSchema, req.query);
  const resultado = await listarUsuarios(filtros);
  return res.status(200).json(resultado);
}

export async function obterUsuarioController(req: Request, res: Response) {
  const usuario = await obterUsuario(String(req.params.id));
  return res.status(200).json(usuario);
}

export async function criarUsuarioController(req: Request, res: Response) {
  const dados = validar(criarUsuarioSchema, req.body ?? {});
  const usuario = await criarUsuario(dados, usuarioAutenticado(res).id);
  return res.status(201).location(`/api/v1/usuarios/${usuario.id}`).json({
    mensagem: "Usuário cadastrado com sucesso.",
    dados: usuario,
  });
}

export async function atualizarUsuarioController(req: Request, res: Response) {
  const dados = validar(atualizarUsuarioSchema, req.body ?? {});
  const usuario = await atualizarUsuario(String(req.params.id), dados, usuarioAutenticado(res).id);
  return res.status(200).json({
    mensagem: "Usuário atualizado com sucesso.",
    dados: usuario,
  });
}

export async function inativarUsuarioController(req: Request, res: Response) {
  const usuario = await inativarUsuario(String(req.params.id), usuarioAutenticado(res).id);
  return res.status(200).json({
    mensagem: "Usuário inativado com sucesso.",
    dados: usuario,
  });
}
