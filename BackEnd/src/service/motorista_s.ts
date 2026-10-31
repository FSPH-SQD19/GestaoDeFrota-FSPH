import { hashPassword } from "./password_s";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validarDataValidadeCnh } from "./validarCNH_s";
import { registrarAuditoria } from "./auditoria_s";

interface MotoristaInput {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
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
    console.error(`Falha ao registrar auditoria do motorista (${acao})`, registroId, erro);
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

export async function cadastrarMotorista(dados: MotoristaInput, usuarioResponsavelId: string) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  if (!nome || nome.length > 150) {
    throw new Error("Nome inválido.");
  }
  if (!z.email().safeParse(email).success || email.length > 150) {
    throw new Error("E-mail inválido.");
  }
  if (Array.from(dados.senha).length < 6) {
    throw new Error("A senha deve possuir pelo menos 6 caracteres.");
  }

  if (Buffer.byteLength(dados.senha, "utf8") > 72) {
    throw new Error("A senha deve ter no máximo 72 bytes.");
  }

  const telefone = dados.telefone.replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(telefone)) {
    throw new Error("Telefone deve conter DDD e 8 ou 9 dígitos.");
  }
  const telefoneFormatado =
    telefone.length === 11
      ? telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
      : telefone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");

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

  const validadeCnh = validarDataValidadeCnh(dados.validadeCnh);

  const existente = await prisma.motorista.findFirst({
    where: {
      OR: [{ cpf }, { numeroCnh }],
    },
    select: { id: true },
  });

  if (existente) {
    throw new Error("CPF ou CNH já cadastrado.");
  }

  const senhaHash = await hashPassword(dados.senha);

  try {
    const motorista = await prisma.$transaction(async (tx) => {
      const perfilMotorista = await tx.perfil.findUnique({
        where: { nome: "MOTORISTA" },
        select: { id: true },
      });
      if (!perfilMotorista) {
        throw new Error("Perfil MOTORISTA não encontrado.");
      }

      const usuario = await tx.usuario.create({
        data: {
          nome,
          email,
          senhaHash,
          ativo: true,
          perfis: { create: { perfilId: perfilMotorista.id } },
        },
        select: { id: true },
      });

      return tx.motorista.create({
        data: {
          usuarioId: usuario.id,
          cpf,
          numeroCnh,
          categoriaCnh,
          validadeCnh,
          telefone: telefoneFormatado,
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
    });
    await registrarAuditoriaMotorista(usuarioResponsavelId, "CRIAR", motorista.id, motorista);
    return motorista;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("E-mail, CPF ou CNH já cadastrado.");
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

    await registrarAuditoriaMotorista(usuarioResponsavelId, "ATUALIZAR", motorista.id, motorista);

    return motorista;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("Motorista não encontrado.");
    }

    throw error;
  }
}

//Função "excluir" motorista apenas o inativa
export async function excluirMotorista(id: string, usuarioResponsavelId: string) {
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

    await registrarAuditoriaMotorista(usuarioResponsavelId, "ATUALIZAR", motorista.id, {
      operacao: "INATIVAR",
      motorista,
    });

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
