import type { Request, Response } from "express";
import { validar } from "./veiculo_c";
import { usuarioAutenticado } from "../middleware/http_m";
import {
  criarDocumentoVeiculo,
  criarDocumentoVeiculoSchema,
  listarDocumentosVeiculo,
} from "../service/documento_veiculo_s";

// Listinha
export async function listarDocumentosVeiculoController(req: Request, res: Response) {
  const resultado = await listarDocumentosVeiculo(String(req.params.id));
  return res.status(200).json(resultado);
}

export async function criarDocumentoVeiculoController(req: Request, res: Response) {
  const dados = validar(criarDocumentoVeiculoSchema, req.body ?? {});
  const documento = await criarDocumentoVeiculo(
    String(req.params.id),
    dados,
    usuarioAutenticado(res).id,
  );
  return res.status(201).json(documento);
}
