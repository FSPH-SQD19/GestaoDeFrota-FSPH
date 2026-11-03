import { HttpError } from "../lib/http_error";
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
  const razaoSocial = typeof dados.razaoSocial === "string" ? dados.razaoSocial.trim() : undefined;
  const cnpj = typeof dados.cnpj === "string" ? dados.cnpj.replace(/\D/g, "") : undefined;
  const tipoServico =
    typeof dados.tipoServico === "string" ? dados.tipoServico.trim().toUpperCase() : undefined;

  if (!razaoSocial || !cnpj || !tipoServico) {
    throw new HttpError(400, "Preencha os campos obrigatórios do fornecedor.");
  }

  if (!/^\d{14}$/.test(cnpj)) {
    throw new HttpError(400, "Confira o CNPJ informado e tente novamente.");
  }

  if (!TIPOS_PERMITIDOS.includes(tipoServico)) {
    throw new HttpError(400, "Selecione o tipo de serviço do fornecedor.");
  }

  const existente = await prisma.fornecedor.findUnique({
    where: { cnpj },
  });

  if (existente) {
    throw new HttpError(
      409,
      "Já existe um fornecedor com este CNPJ. Confira o cadastro existente.",
    );
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
      throw new HttpError(
        409,
        "Já existe um fornecedor com este CNPJ. Confira o cadastro existente.",
      );
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
    throw new HttpError(400, "Não foi possível identificar o fornecedor. Selecione-o novamente.");
  }

  if (
    dados.razaoSocial === undefined &&
    dados.tipoServico === undefined &&
    dados.ativo === undefined
  ) {
    throw new HttpError(400, "Preencha os campos obrigatórios do fornecedor.");
  }

  const dadosAtualizados: AtualizarFornecedor = {};

  if (dados.razaoSocial !== undefined) {
    if (typeof dados.razaoSocial !== "string" || !dados.razaoSocial.trim()) {
      throw new HttpError(400, "Preencha os campos obrigatórios do fornecedor.");
    }

    dadosAtualizados.razaoSocial = dados.razaoSocial.trim();
  }

  if (dados.tipoServico !== undefined) {
    if (typeof dados.tipoServico !== "string") {
      throw new HttpError(400, "Selecione o tipo de serviço do fornecedor.");
    }

    const tipoServico = dados.tipoServico.trim().toUpperCase();

    if (!TIPOS_PERMITIDOS.includes(tipoServico)) {
      throw new HttpError(400, "Selecione o tipo de serviço do fornecedor.");
    }

    dadosAtualizados.tipoServico = tipoServico;
  }

  if (dados.ativo !== undefined) {
    if (typeof dados.ativo !== "boolean") {
      throw new HttpError(400, "Informe se o fornecedor está ativo ou inativo.");
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
      throw new HttpError(404, "Fornecedor não encontrado. Atualize a lista e tente novamente.");
    }

    throw erro;
  }

  await registrarAuditoriaFornecedor(usuarioResponsavelId, "ATUALIZAR", fornecedor);

  return fornecedor;
}

export async function inativarFornecedor(id: string, usuarioResponsavelId: string) {
  if (!z.uuid().safeParse(id).success) {
    throw new HttpError(400, "Não foi possível identificar o fornecedor. Selecione-o novamente.");
  }

  let fornecedor;

  try {
    fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: { ativo: false },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new HttpError(404, "Fornecedor não encontrado. Atualize a lista e tente novamente.");
    }

    throw erro;
  }

  await registrarAuditoriaFornecedor(usuarioResponsavelId, "ATUALIZAR", fornecedor, "INATIVAR");

  return fornecedor;
}
