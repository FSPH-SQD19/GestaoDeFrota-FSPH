import { Request, Response } from "express";
import {
  listarMotoristas,
  cadastrarMotorista,
  atualizarMotorista,
  excluirMotorista,
} from "../service/motorista_s";
import { usuarioAutenticado } from "../middleware/http_m";

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
      return res.status(400).json({
        mensagem: "Informe nome, e-mail, senha, telefone, CPF, CNH, categoria e validade.",
      });
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
  } catch (error) {
    if (error instanceof Error) {
      const errosValidacao = [
        "Nome inválido.",
        "A senha deve ter no máximo 72 bytes.",
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

      if (
        ["E-mail, CPF ou CNH já cadastrado.", "CPF ou CNH já cadastrado."].includes(error.message)
      ) {
        return res.status(409).json({ mensagem: error.message });
      }
    }

    console.error("Erro ao cadastrar motorista:", error);
    return res.status(500).json({ mensagem: "Erro ao cadastrar motorista." });
  }
}

export async function atualizarMotoristaController(req: Request, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({ mensagem: "ID do motorista inválido." });
    }

    const { validadeCnh, ativo } = req.body ?? {};

    if (
      (validadeCnh !== undefined && typeof validadeCnh !== "string") ||
      (ativo !== undefined && typeof ativo !== "boolean")
    ) {
      return res.status(400).json({
        mensagem: "Validade da CNH deve ser texto e ativo deve ser booleano.",
      });
    }

    const motorista = await atualizarMotorista(
      id,
      { validadeCnh, ativo },
      usuarioAutenticado(res).id,
    );

    return res.status(200).json(motorista);
  } catch (error) {
    if (error instanceof Error) {
      const errosValidacao = [
        "ID do motorista inválido.",
        "Informe a validade da CNH ou o status ativo.",
        "Data de validade deve estar no formato AAAA-MM-DD.",
        "Data de validade da CNH inválida.",
        "A CNH está vencida.",
      ];

      if (errosValidacao.includes(error.message)) {
        return res.status(400).json({ mensagem: error.message });
      }

      if (error.message === "Motorista não encontrado.") {
        return res.status(404).json({ mensagem: error.message });
      }
    }

    console.error("Erro ao atualizar motorista:", error);
    return res.status(500).json({ mensagem: "Erro ao atualizar motorista." });
  }
}

export async function excluirMotoristaController(req: Request, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({ mensagem: "ID do motorista inválido." });
    }

    const resultado = await excluirMotorista(id, usuarioAutenticado(res).id);
    return res.status(200).json(resultado);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ID do motorista inválido.") {
        return res.status(400).json({ mensagem: error.message });
      }

      if (error.message === "Motorista não encontrado.") {
        return res.status(404).json({ mensagem: error.message });
      }

      if (
        error.message ===
        "Não é possível excluir este motorista porque existem registros vinculados a ele."
      ) {
        return res.status(409).json({ mensagem: error.message });
      }
    }

    console.error("Erro ao excluir motorista:", error);
    return res.status(500).json({ mensagem: "Erro ao excluir motorista." });
  }
}
