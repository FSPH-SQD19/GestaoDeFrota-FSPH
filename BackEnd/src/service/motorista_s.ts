import { hashPassword } from "./password_s";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http_error";
import { prisma } from "../lib/prisma";
import { validarDataValidadeCnh } from "./validarCNH_s";
import { registrarAuditoria } from "./auditoria_s";
import { invalidarCacheSincronizacaoNotificacoes } from "./notificacao_sync_cache";
import { normalizarTelefone } from "./telefone_s";

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
  nome?: string;
  email?: string;
  telefone?: string | null;
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
    throw new HttpError(400, "Nome inválido.");
  }
  if (!z.email().safeParse(email).success || email.length > 150) {
    throw new HttpError(400, "E-mail inválido.");
  }
  if (Array.from(dados.senha).length < 6) {
    throw new HttpError(400, "A senha deve possuir pelo menos 6 caracteres.");
  }

  if (Buffer.byteLength(dados.senha, "utf8") > 72) {
    throw new HttpError(400, "A senha é muito longa. Use uma senha mais curta.");
  }

  const telefone = dados.telefone.replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(telefone)) {
    throw new HttpError(400, "Telefone deve conter DDD e 8 ou 9 dígitos.");
  }
  const telefoneFormatado =
    telefone.length === 11
      ? telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
      : telefone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");

  const cpf = dados.cpf.replace(/\D/g, "");
  const numeroCnh = dados.numeroCnh.trim();
  const categoriaCnh = dados.categoriaCnh.trim().toUpperCase();

  if (!validarCpf(cpf)) {
    throw new HttpError(400, "CPF inválido.");
  }

  if (!/^\d{11}$/.test(numeroCnh)) {
    throw new HttpError(400, "Número da CNH deve conter 11 dígitos.");
  }

  if (!(CATEGORIAS_CNH as readonly string[]).includes(categoriaCnh)) {
    throw new HttpError(400, "Categoria da CNH inválida.");
  }

  const validadeCnh = validarDataValidadeCnh(dados.validadeCnh);

  const existente = await prisma.motorista.findFirst({
    where: {
      OR: [{ cpf }, { numeroCnh }],
    },
    select: { id: true },
  });

  if (existente) {
    throw new HttpError(409, "CPF ou CNH já cadastrado.");
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
          telefone: telefoneFormatado,
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
    invalidarCacheSincronizacaoNotificacoes();
    await registrarAuditoriaMotorista(usuarioResponsavelId, "CRIAR", motorista.id, motorista);
    return motorista;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "E-mail, CPF ou CNH já cadastrado.");
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
    throw new HttpError(400, "Não foi possível identificar o motorista. Selecione-o novamente.");
  }

  if (
    dados.nome === undefined &&
    dados.email === undefined &&
    dados.telefone === undefined &&
    dados.validadeCnh === undefined &&
    dados.ativo === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um dado para atualizar o motorista.");
  }

  const dadosAtualizados: {
    telefone?: string | null;
    validadeCnh?: Date;
    ativo?: boolean;
  } = {};
  const dadosUsuario: { nome?: string; email?: string; telefone?: string | null; ativo?: boolean } =
    {};

  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome || nome.length > 150) throw new HttpError(400, "Nome inválido.");
    dadosUsuario.nome = nome;
  }

  if (dados.email !== undefined) {
    const email = dados.email.trim().toLowerCase();
    if (!z.email().safeParse(email).success || email.length > 150) {
      throw new HttpError(400, "E-mail inválido.");
    }
    dadosUsuario.email = email;
  }

  if (dados.telefone !== undefined) {
    const telefone = normalizarTelefone(dados.telefone);
    dadosAtualizados.telefone = telefone ?? null;
    dadosUsuario.telefone = telefone ?? null;
  }

  if (dados.validadeCnh !== undefined) {
    dadosAtualizados.validadeCnh = validarDataValidadeCnh(dados.validadeCnh);
  }

  if (dados.ativo !== undefined) {
    dadosAtualizados.ativo = dados.ativo;
    dadosUsuario.ativo = dados.ativo;
  }

  try {
    const motorista = await prisma.$transaction(async (tx) => {
      const atual = await tx.motorista.findUnique({
        where: { id },
        select: { usuarioId: true },
      });
      if (!atual) throw new HttpError(404, "Motorista não encontrado.");
      if (dados.ativo === false && atual.usuarioId === usuarioResponsavelId) {
        throw new HttpError(400, "Você não pode inativar a própria conta.");
      }
      if ((dados.nome !== undefined || dados.email !== undefined) && !atual.usuarioId) {
        throw new HttpError(409, "Motorista sem conta de usuário vinculada.");
      }

      if (atual.usuarioId && Object.keys(dadosUsuario).length > 0) {
        await tx.usuario.update({
          where: { id: atual.usuarioId },
          data: dadosUsuario,
        });
        if (dados.ativo === false) {
          await tx.authSessao.deleteMany({ where: { usuarioId: atual.usuarioId } });
        }
      }

      return tx.motorista.update({
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
    });

    invalidarCacheSincronizacaoNotificacoes();
    await registrarAuditoriaMotorista(usuarioResponsavelId, "ATUALIZAR", motorista.id, motorista);

    return motorista;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Motorista não encontrado.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Já existe um usuário com este e-mail.");
    }

    throw error;
  }
}

//Função "excluir" motorista apenas o inativa
export async function excluirMotorista(id: string, usuarioResponsavelId: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "Não foi possível identificar o motorista. Selecione-o novamente.");
  }

  try {
    const motorista = await prisma.$transaction(async (tx) => {
      const atual = await tx.motorista.findUnique({
        where: { id },
        select: { usuarioId: true },
      });
      if (!atual) throw new HttpError(404, "Motorista não encontrado.");
      if (atual.usuarioId === usuarioResponsavelId) {
        throw new HttpError(400, "Você não pode inativar a própria conta.");
      }
      if (atual.usuarioId) {
        await tx.usuario.update({
          where: { id: atual.usuarioId },
          data: { ativo: false },
        });
        await tx.authSessao.deleteMany({ where: { usuarioId: atual.usuarioId } });
      }
      return tx.motorista.update({
        where: { id },
        data: { ativo: false },
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

    invalidarCacheSincronizacaoNotificacoes();
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
      throw new HttpError(404, "Motorista não encontrado.");
    }

    throw error;
  }
}
