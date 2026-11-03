import { Request, Response } from "express";
import {
  listarMotoristas,
  cadastrarMotorista,
  atualizarMotorista,
  excluirMotorista,
} from "../service/motorista_s";
import { usuarioAutenticado } from "../middleware/http_m";
import { HttpError } from "../lib/http_error";

export async function listarMotoristasController(req: Request, res: Response) {
  const motoristas = await listarMotoristas();
  return res.status(200).json(motoristas);
}

export async function cadastrarMotoristaController(req: Request, res: Response) {
  const { nome, email, senha, telefone, cpf, numeroCnh, categoriaCnh, validadeCnh } =
    req.body ?? {};
  if (
    typeof nome !== "string" ||
    typeof email !== "string" ||
    typeof senha !== "string" ||
    typeof telefone !== "string" ||
    typeof cpf !== "string" ||
    typeof numeroCnh !== "string" ||
    typeof categoriaCnh !== "string" ||
    typeof validadeCnh !== "string" ||
    !nome.trim() ||
    !email.trim() ||
    !senha ||
    !telefone.trim() ||
    !cpf.trim() ||
    !numeroCnh.trim() ||
    !categoriaCnh.trim() ||
    !validadeCnh.trim()
  ) {
    throw new HttpError(
      400,
      "Informe nome, e-mail, senha, telefone, CPF, CNH, categoria e validade.",
    );
  }

  const motorista = await cadastrarMotorista(
    {
      nome,
      email,
      senha,
      telefone,
      cpf,
      numeroCnh,
      categoriaCnh,
      validadeCnh,
    },
    usuarioAutenticado(res).id,
  );
  return res.status(201).json(motorista);
}

export async function atualizarMotoristaController(req: Request, res: Response) {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new HttpError(400, "Não foi possível identificar o motorista. Selecione-o novamente.");
  }

  const { validadeCnh, ativo } = req.body ?? {};

  if (
    (validadeCnh !== undefined && typeof validadeCnh !== "string") ||
    (ativo !== undefined && typeof ativo !== "boolean")
  ) {
    throw new HttpError(400, "Confira a validade da CNH e a opção de motorista ativo.");
  }

  const motorista = await atualizarMotorista(
    id,
    { validadeCnh, ativo },
    usuarioAutenticado(res).id,
  );

  return res.status(200).json(motorista);
}

export async function excluirMotoristaController(req: Request, res: Response) {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new HttpError(400, "Não foi possível identificar o motorista. Selecione-o novamente.");
  }

  const resultado = await excluirMotorista(id, usuarioAutenticado(res).id);
  return res.status(200).json(resultado);
}
