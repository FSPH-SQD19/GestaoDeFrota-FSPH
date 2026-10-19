import { Request, Response } from "express";
import {listarMotoristas,cadastrarMotorista} from "../service/motorista_s";

export async function listarMotoristasController(req: Request,res: Response) {
  try {
    const motoristas = await listarMotoristas();
    return res.status(200).json(motoristas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({mensagem: "Erro ao listar motoristas."});
  }
}

export async function cadastrarMotoristaController(req: Request,res: Response) {
  try {
    const { usuarioId, cpf, numeroCnh, categoriaCnh, validadeCnh } = req.body;
    if (
      typeof cpf !== "string" ||
      typeof numeroCnh !== "string" ||
      typeof categoriaCnh !== "string" ||
      typeof validadeCnh !== "string" ||
      !cpf.trim() ||
      !numeroCnh.trim() ||
      !categoriaCnh.trim() ||
      !validadeCnh.trim()
    ) {
      return res.status(400).json({mensagem: "Informe CPF, número da CNH, categoria e validade."});
    }

    if (
      usuarioId !== undefined && typeof usuarioId !== "string"
    ) {
      return res.status(400).json({mensagem: "usuarioId deve ser uma string.",});
    }

    const motorista = await cadastrarMotorista({usuarioId,cpf,numeroCnh,categoriaCnh,validadeCnh,});

    return res.status(201).json(motorista);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CPF ou número da CNH já cadastrado." || error.message === "Este usuário já está vinculado a um motorista."
      ) {
        return res.status(409).json({mensagem: error.message});
      }

      if (error.message === "Usuário não encontrado." || error.message === "Data de validade da CNH inválida."
      ) {
        return res.status(400).json({mensagem: error.message});
      }
    }
    console.error(error);
    return res.status(500).json({mensagem: "Erro ao cadastrar motorista."});
  }
}