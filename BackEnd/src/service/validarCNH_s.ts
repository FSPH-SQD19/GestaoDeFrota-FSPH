import { prisma } from "../lib/prisma";

export function validarDataValidadeCnh(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error("Data de validade deve estar no formato AAAA-MM-DD.");
  }

  const validadeCnh = new Date(`${valor}T00:00:00.000Z`);

  if (
    Number.isNaN(validadeCnh.getTime()) ||
    validadeCnh.toISOString().slice(0, 10) !== valor
  ) {
    throw new Error("Data de validade da CNH inválida.");
  }

  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  if (valor < hoje) {
    throw new Error("A CNH está vencida.");
  }

  return validadeCnh;
}

/**
 * Verifica se a CNH cadastrada para um motorista está válida.
 * Use esta função antes de permitir a alocação/uso do motorista.
 */
export async function validarCnh(motoristaId: string): Promise<boolean> {
  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const motorista = await prisma.motorista.findUnique({
    where: {
      id: motoristaId,
    },
    select: {
      id: true,
      validadeCnh: true,
    },
  });

  if (!motorista) {
    throw new Error("Motorista não encontrado.");
  }

  if (
    !motorista.validadeCnh ||
    motorista.validadeCnh.toISOString().slice(0, 10) < hoje
  ) {
    throw new Error("CNH vencida. Alocação bloqueada.");
  }

  return true;
}
