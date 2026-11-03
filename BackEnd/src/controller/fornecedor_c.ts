import type { Request, Response } from "express";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  listarFornecedores,
  cadastrarFornecedor,
  atualizarFornecedor,
  inativarFornecedor,
} from "../service/fornecedor_s";

export async function listarFornecedoresController(_req: Request, res: Response) {
  const fornecedores = await listarFornecedores();

  return res.status(200).json({
    total: fornecedores.length,
    dados: fornecedores,
  });
}

export async function cadastrarFornecedorController(req: Request, res: Response) {
  const usuarioId = usuarioAutenticado(res).id;

  const fornecedor = await cadastrarFornecedor(req.body ?? {}, usuarioId);

  return res.status(201).json({
    mensagem: "Fornecedor cadastrado com sucesso.",
    dados: fornecedor,
  });
}

export async function atualizarFornecedorController(req: Request, res: Response) {
  const usuarioId = usuarioAutenticado(res).id;

  const fornecedor = await atualizarFornecedor(String(req.params.id), req.body ?? {}, usuarioId);

  return res.status(200).json({
    mensagem: "Fornecedor atualizado com sucesso.",
    dados: fornecedor,
  });
}

export async function inativarFornecedorController(req: Request, res: Response) {
  const usuarioId = usuarioAutenticado(res).id;

  const fornecedor = await inativarFornecedor(String(req.params.id), usuarioId);

  return res.status(200).json({
    mensagem: "Fornecedor inativado com sucesso.",
    dados: fornecedor,
  });
}
