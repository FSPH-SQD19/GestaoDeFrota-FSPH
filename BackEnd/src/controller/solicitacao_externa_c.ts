import type { Request, Response } from "express";
import { HttpError } from "../lib/http_error";
import { validar } from "../lib/validar";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  chaveIdempotenciaSchema,
  complementarSolicitacaoExterna,
  complementarSolicitacaoExternaSchema,
  criarSolicitacaoExterna,
  criarSolicitacaoExternaSchema,
  detalharSolicitacaoExterna,
  listarSolicitacoesExternas,
  listarSolicitacoesExternasSchema,
  solicitacaoExternaIdSchema,
} from "../service/solicitacao_externa_s";

export async function criarSolicitacaoExternaController(req: Request, res: Response) {
  const chave = chaveIdempotenciaSchema.safeParse(req.header("idempotency-key"));
  if (!chave.success) {
    throw new HttpError(400, "Informe o cabeçalho Idempotency-Key.", [
      {
        campo: "Idempotency-Key",
        mensagem: chave.error.issues[0]?.message ?? "Informe um UUID válido.",
      },
    ]);
  }

  const dados = validar(criarSolicitacaoExternaSchema, req.body ?? {});
  const { solicitacao, criada } = await criarSolicitacaoExterna(
    dados,
    usuarioAutenticado(res).id,
    chave.data,
  );

  if (criada) {
    res.location(`/api/v1/svo/solicitacoes-externas/${solicitacao.id}`);
  }
  return res.status(criada ? 201 : 200).json(solicitacao);
}

export async function listarSolicitacoesExternasController(req: Request, res: Response) {
  const filtros = validar(listarSolicitacoesExternasSchema, req.query);
  const resultado = await listarSolicitacoesExternas(filtros, usuarioAutenticado(res).id);
  return res.status(200).json(resultado);
}

export async function detalharSolicitacaoExternaController(req: Request, res: Response) {
  const { id } = validar(solicitacaoExternaIdSchema, req.params);
  const solicitacao = await detalharSolicitacaoExterna(id, usuarioAutenticado(res).id);
  return res.status(200).json(solicitacao);
}

export async function complementarSolicitacaoExternaController(req: Request, res: Response) {
  const { id } = validar(solicitacaoExternaIdSchema, req.params);
  const dados = validar(complementarSolicitacaoExternaSchema, req.body ?? {});
  const solicitacao = await complementarSolicitacaoExterna(id, dados, usuarioAutenticado(res));
  return res.status(200).json(solicitacao);
}
