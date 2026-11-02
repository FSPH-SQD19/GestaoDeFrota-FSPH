import type { Request, Response } from "express";
import { validar } from "./veiculo_c";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  listarNotificacoes,
  listarNotificacoesQuerySchema,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
} from "../service/notificacao_s";

export async function listarNotificacoesController(req: Request, res: Response) {
  const query = validar(listarNotificacoesQuerySchema, req.query);
  const resultado = await listarNotificacoes(usuarioAutenticado(res), query);
  return res.status(200).json(resultado);
}

export async function marcarNotificacaoLidaController(req: Request, res: Response) {
  const notificacao = await marcarNotificacaoComoLida(
    String(req.params.id),
    usuarioAutenticado(res).id,
  );
  return res.status(200).json(notificacao);
}

export async function marcarTodasNotificacoesLidasController(_req: Request, res: Response) {
  const resultado = await marcarTodasNotificacoesComoLidas(usuarioAutenticado(res).id);
  return res.status(200).json(resultado);
}
