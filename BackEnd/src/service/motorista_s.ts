import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validarDataValidadeCnh } from "./validarCNH_s";
import { registrarAuditoria } from "./auditoria_s";

interface MotoristaInput {
  usuarioId?: string;
  cpf: string;
  numeroCnh: string;
  categoriaCnh: string;
  validadeCnh: string;
}

interface AtualizarMotoristaInput {
  validadeCnh?: string;
  ativo?: boolean;
}

type AcaoAuditoriaMotorista = "CRIAR" | "ATUALIZAR";

const CATEGORIAS_CNH = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "AB",
  "AC",
  "AD",
  "AE",
  "BC",
  "BD",
  "BE",
  "CD",
  "CE",
  "DE",
] as const;

function validarCpf(cpf: string): boolean {
  const numeros = cpf.replace(/\D/g, "");

  if (!/^\d{11}$/.test(numeros) || /^(\d)\1{10}$/.test(numeros)) {
    return false;
  }

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce(
      (total, digito, indice) => total + Number(digito) * (pesoInicial - indice),
      0,
    );

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiro = calcularDigito(numeros.slice(0, 9), 10);
  const segundo = calcularDigito(numeros.slice(0, 10), 11);

  return primeiro === Number(numeros[9]) && segundo === Number(numeros[10]);
}

/** Registra auditoria sem desfazer uma operação de negócio se o log falhar. */
async function registrarAuditoriaMotorista(
  usuarioResponsavelId: string,
  acao: AcaoAuditoriaMotorista,
  registroId: string,
  dadosNovos: unknown,
): Promise<void> {
  try {
    await registrarAuditoria({
      usuarioId: usuarioResponsavelId,
      acao,
      tabelaAfetada: "motoristas",
      registroId,
      dadosNovos: JSON.parse(JSON.stringify(dadosNovos)),
    });
  } catch (erro) {
    console.error(
      `Falha ao registrar auditoria do motorista (${acao})`,
      registroId,
      erro,
    );
  }
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
    orderBy: { cpf: "asc" },
  });
}

export async function cadastrarMotorista(
  dados: MotoristaInput,
  usuarioResponsavelId: string,
) {
  if (!z.uuid().optional().safeParse(dados.usuarioId).success) {
    throw new Error("usuarioId inválido.");
  }

  const cpf = dados.cpf.replace(/\D/g, "");
  const numeroCnh = dados.numeroCnh.trim();
  const categoriaCnh = dados.categoriaCnh.trim().toUpperCase();

  if (!validarCpf(cpf)) {
    throw new Error("CPF inválido.");
  }

  if (!/^\d{11}$/.test(numeroCnh)) {
    throw new Error("Número da CNH deve conter 11 dígitos.");
  }

  if (!(CATEGORIAS_CNH as readonly string[]).includes(categoriaCnh)) {
    throw new Error("Categoria da CNH inválida.");
  }

  // Formato, data real e vencimento são validados em um único lugar.
  const validadeCnh = validarDataValidadeCnh(dados.validadeCnh);

  const existente = await prisma.motorista.findFirst({
    where: {
      OR: [{ cpf }, { numeroCnh }, ...(dados.usuarioId ? [{ usuarioId: dados.usuarioId }] : [])],
    },
    select: { id: true },
  });

  if (existente) {
    throw new Error("CPF, CNH ou usuário já vinculado a um motorista.");
  }

  if (dados.usuarioId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: dados.usuarioId },
      select: { id: true },
    });

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }
  }

  try {
    const motorista = await prisma.motorista.create({
      data: {
        usuarioId: dados.usuarioId,
        cpf,
        numeroCnh,
        categoriaCnh,
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

    await registrarAuditoriaMotorista(
      usuarioResponsavelId,
      "CRIAR",
      motorista.id,
      motorista,
    );

    return motorista;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("CPF, CNH ou usuário já vinculado a um motorista.");
    }

    throw error;
  }
}

export async function atualizarMotorista(
  id: string,
  dados: AtualizarMotoristaInput,
  usuarioResponsavelId: string,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new Error("ID do motorista inválido.");
  }

  if (dados.validadeCnh === undefined && dados.ativo === undefined) {
    throw new Error("Informe a validade da CNH ou o status ativo.");
  }

  const dadosAtualizados: { validadeCnh?: Date; ativo?: boolean } = {};

  if (dados.validadeCnh !== undefined) {
    dadosAtualizados.validadeCnh = validarDataValidadeCnh(dados.validadeCnh);
  }

  if (dados.ativo !== undefined) {
    dadosAtualizados.ativo = dados.ativo;
  }

  try {
    const motorista = await prisma.motorista.update({
      where: { id },
      data: dadosAtualizados,
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

    await registrarAuditoriaMotorista(
      usuarioResponsavelId,
      "ATUALIZAR",
      motorista.id,
      motorista,
    );

    return motorista;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new Error("Motorista não encontrado.");
    }

    throw error;
  }
}

//Função "excluir" motorista apenas o inativa
export async function excluirMotorista(
  id: string,
  usuarioResponsavelId: string,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new Error("ID do motorista inválido.");
  }

  try {
    const motorista = await prisma.motorista.update({
      where: { id },
      data: {
        ativo: false,
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

    await registrarAuditoriaMotorista(
      usuarioResponsavelId,
      "ATUALIZAR",
      motorista.id,
      {
        operacao: "INATIVAR",
        motorista,
      },
    );

    return {
      mensagem: "Motorista inativado com sucesso.",
      id: motorista.id,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("Motorista não encontrado.");
    }

    throw error;
  }
}
