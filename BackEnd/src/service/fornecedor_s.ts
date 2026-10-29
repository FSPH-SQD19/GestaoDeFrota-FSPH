import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { registrarAuditoria } from "./auditoria_s";

interface NovoFornecedor {
  razaoSocial: string;
  cnpj: string;
  tipoServico: string;
}

interface AtualizarFornecedor {
  razaoSocial?: string;
  tipoServico?: string;
  ativo?: boolean;
}

const TIPOS_PERMITIDOS = ["LOCADORA", "OFICINA", "POSTO"];

async function registrarAuditoriaFornecedor(
  usuarioResponsavelId: string,
  acao: "CRIAR" | "ATUALIZAR",
  fornecedor: {
    id: string;
    [chave: string]: unknown;
  },
  operacao?: "INATIVAR",
): Promise<void> {
  try {
    await registrarAuditoria({
      usuarioId: usuarioResponsavelId,
      acao,
      tabelaAfetada: "fornecedores",
      registroId: fornecedor.id,
      dadosNovos: JSON.parse(JSON.stringify(operacao ? { operacao, fornecedor } : fornecedor)),
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria do fornecedor", fornecedor.id, erro);
  }
}

export async function listarFornecedores() {
  return prisma.fornecedor.findMany({
    where: { ativo: true },
    orderBy: { razaoSocial: "asc" },
  });
}

export async function cadastrarFornecedor(dados: NovoFornecedor, usuarioResponsavelId: string) {
  const razaoSocial = dados.razaoSocial?.trim();
  const cnpj = dados.cnpj?.replace(/\D/g, "");
  const tipoServico = dados.tipoServico?.trim().toUpperCase();

  if (!razaoSocial || !cnpj || !tipoServico) {
    throw new Error("CAMPOS_OBRIGATORIOS");
  }

  if (!/^\d{14}$/.test(cnpj)) {
    throw new Error("CNPJ_INVALIDO");
  }

  if (!TIPOS_PERMITIDOS.includes(tipoServico)) {
    throw new Error("TIPO_SERVICO_INVALIDO");
  }

  const existente = await prisma.fornecedor.findUnique({
    where: { cnpj },
  });

  if (existente) {
    throw new Error("CNPJ_JA_CADASTRADO");
  }

  let fornecedor;

  try {
    fornecedor = await prisma.fornecedor.create({
      data: {
        razaoSocial,
        cnpj,
        tipoServico,
        ativo: true,
      },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new Error("CNPJ_JA_CADASTRADO");
    }

    throw erro;
  }

  await registrarAuditoriaFornecedor(usuarioResponsavelId, "CRIAR", fornecedor);

  return fornecedor;
}

export async function atualizarFornecedor(
  id: string,
  dados: AtualizarFornecedor,
  usuarioResponsavelId: string,
) {
  if (!z.uuid().safeParse(id).success) {
    throw new Error("ID_INVALIDO");
  }

  if (
    dados.razaoSocial === undefined &&
    dados.tipoServico === undefined &&
    dados.ativo === undefined
  ) {
    throw new Error("CAMPOS_OBRIGATORIOS");
  }

  const dadosAtualizados: AtualizarFornecedor = {};

  if (dados.razaoSocial !== undefined) {
    if (typeof dados.razaoSocial !== "string" || !dados.razaoSocial.trim()) {
      throw new Error("CAMPOS_OBRIGATORIOS");
    }

    dadosAtualizados.razaoSocial = dados.razaoSocial.trim();
  }

  if (dados.tipoServico !== undefined) {
    if (typeof dados.tipoServico !== "string") {
      throw new Error("TIPO_SERVICO_INVALIDO");
    }

    const tipoServico = dados.tipoServico.trim().toUpperCase();

    if (!TIPOS_PERMITIDOS.includes(tipoServico)) {
      throw new Error("TIPO_SERVICO_INVALIDO");
    }

    dadosAtualizados.tipoServico = tipoServico;
  }

  if (dados.ativo !== undefined) {
    if (typeof dados.ativo !== "boolean") {
      throw new Error("ATIVO_INVALIDO");
    }

    dadosAtualizados.ativo = dados.ativo;
  }

  let fornecedor;

  try {
    fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: dadosAtualizados,
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new Error("FORNECEDOR_NAO_ENCONTRADO");
    }

    throw erro;
  }

  await registrarAuditoriaFornecedor(usuarioResponsavelId, "ATUALIZAR", fornecedor);

  return fornecedor;
}

export async function inativarFornecedor(id: string, usuarioResponsavelId: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new Error("ID_INVALIDO");
  }

  let fornecedor;

  try {
    fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: { ativo: false },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new Error("FORNECEDOR_NAO_ENCONTRADO");
    }

    throw erro;
  }

  await registrarAuditoriaFornecedor(usuarioResponsavelId, "ATUALIZAR", fornecedor, "INATIVAR");

  return fornecedor;
}
