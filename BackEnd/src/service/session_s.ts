import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";

export const passwordVersion = (hash: string) => createHash("sha256").update(hash).digest("hex");

export async function createSession(usuarioId: string, senhaHash: string, expiresIn: number) {
  const id = randomUUID();
  await prisma.authSessao.create({
    data: {
      id,
      usuarioId,
      senhaVersao: passwordVersion(senhaHash),
      expiraEm: new Date(Date.now() + expiresIn * 1000),
    },
  });
  return id;
}

export async function resolveSession(usuarioId: string, id: string) {
  const now = new Date();
  const sessao = await prisma.authSessao.findUnique({
    where: { id },
    include: {
      usuario: { include: { perfis: { include: { perfil: true } } } },
    },
  });
  if (
    !sessao ||
    sessao.usuarioId !== usuarioId ||
    !sessao.usuario.ativo ||
    sessao.expiraEm <= now ||
    sessao.senhaVersao !== passwordVersion(sessao.usuario.senhaHash)
  )
    return null;
  return {
    id: sessao.usuario.id,
    nome: sessao.usuario.nome,
    email: sessao.usuario.email,
    perfis: sessao.usuario.perfis.map(({ perfil }) => perfil.nome),
    sessaoId: id,
  };
}

export async function revokeSession(id: string) {
  await prisma.authSessao.deleteMany({ where: { id } });
}
