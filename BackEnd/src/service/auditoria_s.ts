import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type RegistrarAuditoriaInput = {
  usuarioId?: string | null;
  acao: string;
  tabelaAfetada: string;
  registroId?: string | null;
  dadosNovos: Prisma.InputJsonValue;
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