import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  iniciarViagem,
  concluirViagem,
  iniciarViagemSchema,
  concluirViagemSchema,
} from "../service/execucao_s";
import {
  criarSolicitacao,
  criarSolicitacaoSchema,
  listarSolicitacoes,
  listarMinhasViagens,
  listarSolicitacoesSchema,
} from "../service/solicitacao_s";
import {
  aprovarSolicitacao,
  recusarSolicitacao,
  aprovarSolicitacaoSchema,
  recusarSolicitacaoSchema,
  reagendarViagemAprovada,
  reagendarViagemSchema,
} from "../service/aprovacao_s";

export async function iniciarViagemController(req: Request, res: Response) {
  const dados = validar(iniciarViagemSchema, req.body ?? {});
  const execucao = await iniciarViagem(String(req.params.id), dados, usuarioAutenticado(res).id);

  return res.status(201).json(execucao);
}

export async function concluirViagemController(req: Request, res: Response) {
  const dados = validar(concluirViagemSchema, req.body ?? {});
  const execucao = await concluirViagem(String(req.params.id), dados, usuarioAutenticado(res).id);

  return res.status(200).json(execucao);
}

export async function listarMinhasViagensController(req: Request, res: Response) {
  const filtros = validar(listarSolicitacoesSchema, req.query);
  const resultado = await listarMinhasViagens(filtros, usuarioAutenticado(res).id);

  return res.status(200).json(resultado);
}

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

export async function reagendarViagemController(req: Request, res: Response) {
  const dados = validar(reagendarViagemSchema, req.body ?? {});

  const viagemReagendada = await reagendarViagemAprovada(
    String(req.params.id),
    dados,
    usuarioAutenticado(res).id,
  );

  return res.status(200).json({
    mensagem: "Viagem reagendada com sucesso.",
    dados: viagemReagendada,
  });
}
