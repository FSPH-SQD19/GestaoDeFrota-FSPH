import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword } from "./password_s";

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
];

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

export async function cadastrarMotorista(dados: MotoristaInput) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  if (!nome || nome.length > 150) {
    throw new Error("Nome inválido.");
  }
  if (!z.email().safeParse(email).success || email.length > 150) {
    throw new Error("E-mail inválido.");
  }
  if (dados.senha.length < 4) {
    throw new Error("A senha deve possuir pelo menos 4 caracteres.");
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

  if (!CATEGORIAS_CNH.includes(categoriaCnh)) {
    throw new Error("Categoria da CNH inválida.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.validadeCnh)) {
    throw new Error("Data de validade deve estar no formato AAAA-MM-DD.");
  }

  const validadeCnh = new Date(`${dados.validadeCnh}T00:00:00.000Z`);

  if (
    Number.isNaN(validadeCnh.getTime()) ||
    validadeCnh.toISOString().slice(0, 10) !== dados.validadeCnh
  ) {
    throw new Error("Data de validade da CNH inválida.");
  }

  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  if (dados.validadeCnh < hoje) {
    throw new Error("A CNH está vencida.");
  }

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
    return await prisma.$transaction(async (tx) => {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("E-mail, CPF ou CNH já cadastrado.");
    }

    throw error;
  }
}
