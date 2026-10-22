import { prisma } from "../lib/prisma";

export async function validarCnh(usuarioId: string): Promise<boolean> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const motorista = await prisma.motorista.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      id: true,
      validadeCnh: true,
    },
  });

  if (!motorista) {
    throw new Error("Motorista não encontrado.");
  }

  if (!motorista.validadeCnh || motorista.validadeCnh < hoje) {
      throw new Error("CNH vencida. Alocação bloqueada.");
    }

  return true;
}