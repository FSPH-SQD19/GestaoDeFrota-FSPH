import { Request, Response } from "express";
import { listarMotoristas, cadastrarMotorista } from "../service/motorista_s";

export async function listarMotoristasController(req: Request, res: Response) {
  try {
    const motoristas = await listarMotoristas();
    return res.status(200).json(motoristas);
  } catch (error) {
    console.error("Erro ao listar motoristas:", error);
    return res.status(500).json({ mensagem: "Erro ao listar motoristas." });
  }
}

export async function cadastrarMotoristaController(req: Request, res: Response) {
  try {
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
      return res
        .status(400)
        .json({ mensagem: "Informe nome, e-mail, senha, telefone, CPF, CNH, categoria e validade." });
    }

    const motorista = await cadastrarMotorista({
      nome,
      email,
      senha,
      telefone,
      cpf,
      numeroCnh,
      categoriaCnh,
      validadeCnh,
    });
    return res.status(201).json(motorista);
  } catch (error) {
    if (error instanceof Error) {
      const errosValidacao = [
        "Nome inválido.",
        "E-mail inválido.",
        "A senha deve possuir pelo menos 4 caracteres.",
        "Telefone deve conter DDD e 8 ou 9 dígitos.",
        "CPF inválido.",
        "Número da CNH deve conter 11 dígitos.",
        "Categoria da CNH inválida.",
        "Data de validade deve estar no formato AAAA-MM-DD.",
        "Data de validade da CNH inválida.",
        "A CNH está vencida.",
      ];

      if (errosValidacao.includes(error.message)) {
        return res.status(400).json({ mensagem: error.message });
      }

      if (error.message === "E-mail, CPF ou CNH já cadastrado.") {
        return res.status(409).json({ mensagem: error.message });
      }
    }

    console.error("Erro ao cadastrar motorista:", error);
    return res.status(500).json({ mensagem: "Erro ao cadastrar motorista." });
  }
}
