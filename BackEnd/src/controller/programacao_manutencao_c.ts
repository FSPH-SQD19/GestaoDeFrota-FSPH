import type { Request, Response } from "express";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import { manutencaoIdSchema } from "../service/manutencao_s";
import {
  programarManutencaoSchema,
  reagendarManutencaoSchema,
  cancelarProgramacaoSchema,
  conflitosProgramacaoSchema,
  listarProgramacoesSchema,
  salvarProgramacao,
  cancelarProgramacao,
  conflitosProgramacao,
  listarProgramacoes,
} from "../service/programacao_manutencao_s";

export async function listarProgramacoesController(req: Request, res: Response) {
  res
    .set("Cache-Control", "no-store")
    .json(await listarProgramacoes(validar(listarProgramacoesSchema, req.query)));
}
export async function conflitosProgramacaoController(req: Request, res: Response) {
  res
    .set("Cache-Control", "no-store")
    .json(await conflitosProgramacao(validar(conflitosProgramacaoSchema, req.body ?? {})));
}
export async function programarManutencaoController(req: Request, res: Response) {
  const dados = validar(programarManutencaoSchema, req.body ?? {});
  res.status(201).json(await salvarProgramacao(dados, usuarioAutenticado(res).id));
}
export async function reagendarManutencaoController(req: Request, res: Response) {
  const { id } = validar(manutencaoIdSchema, req.params);
  const { versao, ...dados } = validar(reagendarManutencaoSchema, req.body ?? {});
  res.json(await salvarProgramacao(dados, usuarioAutenticado(res).id, { id, versao }));
}
export async function cancelarProgramacaoController(req: Request, res: Response) {
  const { id } = validar(manutencaoIdSchema, req.params);
  const { versao } = validar(cancelarProgramacaoSchema, req.body ?? {});
  res.json(await cancelarProgramacao(id, versao, usuarioAutenticado(res).id));
}
