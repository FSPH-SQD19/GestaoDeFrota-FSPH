import { prisma } from "../lib/prisma";

interface MotoristaInput {
  usuarioId?: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
}

export async function listarMotoristas() {
  return prisma.motorista.findMany({
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
    orderBy: {
      cpf: "asc",
    },
  });
}

export async function cadastrarMotorista(dados: MotoristaInput) {
  const cpf = dados.cpf.trim();
  const numeroCnh = dados.numeroCnh.trim();

  const validadeCnh = new Date(`${dados.validadeCnh}T00:00:00.000Z`);

  if (Number.isNaN(validadeCnh.getTime())) {
    throw new Error("Data de validade da CNH inválida.");
  }

  if (validadeCnh <= new Date("2000-01-01T00:00:00.000Z")) {
    throw new Error("Data de validade da CNH inválida.");
  }

  const existente = await prisma.motorista.findFirst({
    where: {
      OR: [
        { cpf },
        { numeroCnh },
      ],
    },
  });

  if (existente) {
    throw new Error("CPF ou número da CNH já cadastrado.");
  }

  if (dados.usuarioId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: dados.usuarioId },
    });

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }

    const vinculado = await prisma.motorista.findUnique({
      where: { usuarioId: dados.usuarioId },
    });

    if (vinculado) {
      throw new Error("Este usuário já está vinculado a um motorista.");
    }
  }

  return prisma.motorista.create({
    data: {
      usuarioId: dados.usuarioId,
      cpf,
      numeroCnh,
      categoriaCnh: dados.categoriaCnh.trim().toUpperCase(),
      validadeCnh,
    },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  });
}