import { prisma } from "../lib/prisma";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RegistrarAuditoriaInput = {
  usuarioId?: string | null;
  acao: string;
  tabelaAfetada: string;
  registroId?: string | null;
  dadosNovos: JsonValue;
};

export function registrarAuditoria({
  usuarioId = null,
  acao,
  tabelaAfetada,
  registroId = null,
  dadosNovos
}: RegistrarAuditoriaInput) {
  return prisma.auditoriaSistema.create({
    data: {
      usuarioId,
      acao,
      tabelaAfetada,
      registroId,
      dadosNovos
    }
  });
}