import type { Request, Response } from "express";
import { validar } from "./veiculo_c";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  criarSolicitacao,
  criarSolicitacaoSchema,
  listarSolicitacoes,
  listarSolicitacoesSchema,
} from "../service/solicitacao_s";
import {
  aprovarSolicitacao,
  recusarSolicitacao,
  aprovarSolicitacaoSchema,
  recusarSolicitacaoSchema,
} from "../service/aprovacao_s";

export async function listarSolicitacoesController(req: Request, res: Response) {
  const filtros = validar(listarSolicitacoesSchema, req.query);
  const resultado = await listarSolicitacoes(filtros, usuarioAutenticado(res));

  return res.status(200).json(resultado);
}

export async function criarSolicitacaoController(req: Request, res: Response) {
  const dados = validar(criarSolicitacaoSchema, req.body ?? {});
  const solicitacao = await criarSolicitacao(dados, usuarioAutenticado(res).id);

  return res.status(201).json(solicitacao);
}

export async function aprovarSolicitacaoController(req: Request, res: Response) {
  const dados = validar(aprovarSolicitacaoSchema, req.body ?? {});

  const solicitacao = await aprovarSolicitacao(
    String(req.params.id),
    dados,
    usuarioAutenticado(res).id,
  );

  return res.status(200).json({
    mensagem: "Solicitação aprovada com sucesso.",
    dados: solicitacao,
  });
}

export async function recusarSolicitacaoController(req: Request, res: Response) {
  const dados = validar(recusarSolicitacaoSchema, req.body ?? {});

  const solicitacao = await recusarSolicitacao(
    String(req.params.id),
    dados,
    usuarioAutenticado(res).id,
  );

  return res.status(200).json({
    mensagem: "Solicitação recusada com sucesso.",
    dados: solicitacao,
  });
}
