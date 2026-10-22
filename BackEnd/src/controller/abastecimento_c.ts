import type { Request, Response } from "express";
import { validar } from "./veiculo_c";
import { listarAbastecimentos, listarAbastecimentosSchema  } from "../service/abastecimento_s";

export async function listarAbastecimentosController(req: Request, res: Response) {
    const filtros = validar(listarAbastecimentosSchema, req.query);
    const resultado = await listarAbastecimentos(filtros);
    return res.status(200).json(resultado);
} 