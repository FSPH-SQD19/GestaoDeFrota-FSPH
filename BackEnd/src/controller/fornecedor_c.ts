
import { Request, Response } from "express";
import {
  listarFornecedores,
  cadastrarFornecedor,
  atualizarFornecedor,
  inativarFornecedor,
} from "../service/fornecedor_s";

function obterUsuarioResponsavelId(res: Response): string {
  const usuarioId = res.locals.usuario?.id;

  if (typeof usuarioId !== "string" || !usuarioId) {
    throw new Error("USUARIO_NAO_AUTENTICADO");
  }

  return usuarioId;
}

function responderErro(
  res: Response,
  erro: unknown,
  mensagemPadrao: string,
) {
  const mensagem =
    erro instanceof Error ? erro.message : "ERRO_INTERNO";

  const errosConhecidos: Record<string, number> = {
    CAMPOS_OBRIGATORIOS: 400,
    CNPJ_INVALIDO: 400,
    TIPO_SERVICO_INVALIDO: 400,
    ATIVO_INVALIDO: 400,
    ID_INVALIDO: 400,
    USUARIO_NAO_AUTENTICADO: 401,
    FORNECEDOR_NAO_ENCONTRADO: 404,
    CNPJ_JA_CADASTRADO: 409,
  };

  return res.status(errosConhecidos[mensagem] ?? 500).json({
    mensagem: errosConhecidos[mensagem]
      ? mensagem
      : mensagemPadrao,
  });
}

export async function listarFornecedoresController(
  _req: Request,
  res: Response,
) {
  try {
    const fornecedores = await listarFornecedores();

    return res.status(200).json({
      total: fornecedores.length,
      dados: fornecedores,
    });
  } catch {
    return res.status(500).json({
      mensagem: "Erro ao listar fornecedores.",
    });
  }
}

export async function cadastrarFornecedorController(
  req: Request,
  res: Response,
) {
  try {
    const usuarioId = obterUsuarioResponsavelId(res);

    const fornecedor = await cadastrarFornecedor(
      req.body,
      usuarioId,
    );

    return res.status(201).json({
      mensagem: "Fornecedor cadastrado com sucesso.",
      dados: fornecedor,
    });
  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro ao cadastrar fornecedor.",
    );
  }
}

export async function atualizarFornecedorController(
  req: Request,
  res: Response,
) {
  try {
    const usuarioId = obterUsuarioResponsavelId(res);

    const fornecedor = await atualizarFornecedor(
      String(req.params.id),
      req.body,
      usuarioId,
    );

    return res.status(200).json({
      mensagem: "Fornecedor atualizado com sucesso.",
      dados: fornecedor,
    });
  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro ao atualizar fornecedor.",
    );
  }
}

export async function inativarFornecedorController(
  req: Request,
  res: Response,
) {
  try {
    const usuarioId = obterUsuarioResponsavelId(res);

    const fornecedor = await inativarFornecedor(
      String(req.params.id),
      usuarioId,
    );

    return res.status(200).json({
      mensagem: "Fornecedor inativado com sucesso.",
      dados: fornecedor,
    });
  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro ao inativar fornecedor.",
    );
  }
}
