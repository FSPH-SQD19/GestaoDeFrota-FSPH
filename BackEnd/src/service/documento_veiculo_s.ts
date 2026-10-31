import type { DocumentoVeiculo, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/http_m";
import { registrarAuditoria } from "./auditoria_s";

export const TIPOS_DOCUMENTO = ["CRLV", "IPVA", "SEGURO"] as const;
export const SITUACOES_DOCUMENTO = ["VIGENTE", "PROXIMO_VENCIMENTO", "VENCIDO"] as const;

// RB01/RF010-DOC: avisar a partir de três meses antes do vencimento.
export const DIAS_ALERTA_VENCIMENTO = 90;

const FUSO = "America/Sao_Paulo";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export type SituacaoDocumento = (typeof SITUACOES_DOCUMENTO)[number];

// Dia atual (AAAA-MM-DD) no fuso de Sergipe United State Of Brazilian.
export function dataLocal(data: Date = new Date()): string {
  return data.toLocaleDateString("en-CA", { timeZone: FUSO });
}

export function dataDoBanco(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / UM_DIA_MS);
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function calcularSituacao(dataVencimento: string, hoje: string): SituacaoDocumento {
  const dias = diasEntre(hoje, dataVencimento);
  if (dias < 0) return "VENCIDO";
  if (dias <= DIAS_ALERTA_VENCIMENTO) return "PROXIMO_VENCIMENTO";
  return "VIGENTE";
}

export function documentosAtuais<
  T extends Pick<DocumentoVeiculo, "tipoDocumento" | "dataVencimento">,
>(documentos: T[]): Map<string, T> {
  const atuais = new Map<string, T>();
  for (const documento of documentos) {
    if (!documento.tipoDocumento) continue;
    const atual = atuais.get(documento.tipoDocumento);
    if (!atual || documento.dataVencimento > atual.dataVencimento) {
      atuais.set(documento.tipoDocumento, documento);
    }
  }
  return atuais;
}

// Validacoo
const idVeiculoSchema = z.uuid();
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function validarIdVeiculo(id: string) {
  if (!idVeiculoSchema.safeParse(id).success) {
    throw new HttpError(400, "ID do veículo inválido.", [
      { campo: "id", mensagem: "Informe um UUID válido." },
    ]);
  }
}

export const criarDocumentoVeiculoSchema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO, {
    error: "Tipo de documento deve ser CRLV, IPVA ou SEGURO.",
  }),
  dataVencimento: z.iso
    .date({ error: "Data de vencimento deve ser uma data válida no formato AAAA-MM-DD." })
    .refine(
      (data) => !FORMATO_DATA.test(data) || (data >= "2000-01-01" && data <= "2100-12-31"),
      "Data de vencimento fora do intervalo permitido.",
    ),
});

export type CriarDocumentoVeiculoInput = z.infer<typeof criarDocumentoVeiculoSchema>;

// Serializacao
export type DocumentoVeiculoResposta = {
  id: string;
  veiculoId: string;
  tipoDocumento: string | null;
  dataVencimento: string;
  situacao: SituacaoDocumento;
  diasParaVencer: number;
  atual: boolean;
};

function serializarDocumento(
  documento: DocumentoVeiculo,
  hoje: string,
  atual: boolean,
): DocumentoVeiculoResposta {
  const vencimento = dataDoBanco(documento.dataVencimento);
  return {
    id: documento.id,
    veiculoId: documento.veiculoId,
    tipoDocumento: documento.tipoDocumento,
    dataVencimento: vencimento,
    situacao: calcularSituacao(vencimento, hoje),
    diasParaVencer: diasEntre(hoje, vencimento),
    atual,
  };
}

const GRAVIDADE: Record<SituacaoDocumento, number> = {
  VIGENTE: 0,
  PROXIMO_VENCIMENTO: 1,
  VENCIDO: 2,
};

// Servico
async function buscarVeiculo(veiculoId: string) {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: veiculoId },
    select: { id: true, ativo: true },
  });
  if (!veiculo) {
    throw new HttpError(404, "Veículo não encontrado.");
  }
  return veiculo;
}

export async function listarDocumentosVeiculo(veiculoId: string) {
  validarIdVeiculo(veiculoId);
  await buscarVeiculo(veiculoId);

  const documentos = await prisma.documentoVeiculo.findMany({
    where: { veiculoId },
    orderBy: [{ dataVencimento: "desc" }, { id: "asc" }],
  });

  const hoje = dataLocal();
  const atuais = documentosAtuais(documentos);
  const idsAtuais = new Set([...atuais.values()].map((documento) => documento.id));
  const data = documentos.map((documento) =>
    serializarDocumento(documento, hoje, idsAtuais.has(documento.id)),
  );

  let situacaoGeral: SituacaoDocumento | null = null;
  for (const documento of data) {
    if (!documento.atual) continue;
    if (!situacaoGeral || GRAVIDADE[documento.situacao] > GRAVIDADE[situacaoGeral]) {
      situacaoGeral = documento.situacao;
    }
  }

  return {
    data,
    resumo: {
      situacaoGeral,
      bloqueiaAlocacao: situacaoGeral === "VENCIDO",
      tiposSemRegistro: TIPOS_DOCUMENTO.filter((tipo) => !atuais.has(tipo)),
    },
  };
}

export async function criarDocumentoVeiculo(
  veiculoId: string,
  input: CriarDocumentoVeiculoInput,
  usuarioId: string,
) {
  validarIdVeiculo(veiculoId);
  const veiculo = await buscarVeiculo(veiculoId);
  if (!veiculo.ativo) {
    throw new HttpError(422, "Não é possível cadastrar documento para veículo inativo.");
  }

  const dataVencimento = new Date(`${input.dataVencimento}T00:00:00.000Z`);

  const duplicado = await prisma.documentoVeiculo.findFirst({
    where: { veiculoId, tipoDocumento: input.tipoDocumento, dataVencimento },
    select: { id: true },
  });
  if (duplicado) {
    throw new HttpError(409, "Este documento já está cadastrado para o veículo.", [
      { campo: "dataVencimento", mensagem: "Já existe este tipo com o mesmo vencimento." },
    ]);
  }

  const hoje = dataLocal();
  const documento = await prisma.documentoVeiculo.create({
    data: {
      veiculoId,
      tipoDocumento: input.tipoDocumento,
      dataVencimento,
      status: calcularSituacao(input.dataVencimento, hoje),
    },
  });

  const maisRecente = await prisma.documentoVeiculo.findFirst({
    where: {
      veiculoId,
      tipoDocumento: input.tipoDocumento,
      dataVencimento: { gt: dataVencimento },
    },
    select: { id: true },
  });

  const resposta = serializarDocumento(documento, hoje, !maisRecente);

  try {
    await registrarAuditoria({
      usuarioId,
      acao: "CRIAR",
      tabelaAfetada: "documentos_veiculo",
      registroId: documento.id,
      dadosNovos: {
        veiculoId,
        tipoDocumento: input.tipoDocumento,
        dataVencimento: input.dataVencimento,
      },
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria do documento", documento.id, erro);
  }

  return resposta;
}

export async function exigirDocumentosEmDia(
  tx: Prisma.TransactionClient,
  veiculoId: string,
  dataReferencia: string,
) {
  const documentos = await tx.documentoVeiculo.findMany({
    where: { veiculoId, tipoDocumento: { in: [...TIPOS_DOCUMENTO] } },
    select: { tipoDocumento: true, dataVencimento: true },
  });

  const hoje = dataLocal();
  const limite = dataReferencia > hoje ? dataReferencia : hoje;

  const pendencias = [...documentosAtuais(documentos).entries()]
    .map(([tipo, documento]) => ({ tipo, vencimento: dataDoBanco(documento.dataVencimento) }))
    .filter(({ vencimento }) => vencimento < limite)
    .sort((a, b) => a.tipo.localeCompare(b.tipo));

  if (pendencias.length === 0) return;

  throw new HttpError(
    422,
    "Documentação do veículo vencida durante o período da viagem.",
    pendencias.map(({ tipo, vencimento }) => ({
      campo: "veiculoId",
      mensagem:
        vencimento < hoje
          ? `${tipo} vencido em ${formatarData(vencimento)}.`
          : `${tipo} vence em ${formatarData(vencimento)}, antes do retorno da viagem.`,
    })),
  );
}
