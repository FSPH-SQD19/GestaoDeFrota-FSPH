import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listarMotoristasTeste(
  req: Request,
  res: Response
) {
  try {
    const motoristas = await prisma.motorista.findMany({
      where: { ativo: true },
      select: {
        telefone: true,
        status: true,
        validadeCnh: true,
        usuario: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        usuario: {
          nome: "asc",
        },
      },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const resultado = motoristas.map((motorista) => {
      const validade = motorista.validadeCnh;
      validade.setHours(0, 0, 0, 0);

      let status: string;

      if (validade < hoje) {
        status = "CNH_INVALIDA";
      } else if (motorista.status === "EM_ROTA") {
        status = "EM_ROTA";
      } else {
        status = "DISPONIVEL";
      }

      return {
        nome: motorista.usuario?.nome ?? "Sem usuário vinculado",
        telefone: motorista.telefone,
        status,
      };
    });

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao listar motoristas de teste:", erro);

    return res.status(500).json({
      mensagem: "Erro ao consultar motoristas.",
    });
  }
}