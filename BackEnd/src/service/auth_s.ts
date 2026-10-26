import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { comparePassword } from "./password_s";
import { getAuthConfig } from "../config/auth";

interface LoginInput {
  email: string;
  senha: string;
}

export async function login({ email, senha }: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      perfis: {
        include: {
          perfil: true,
        },
      },
    },
  });

  if (!usuario || !usuario.ativo) {
    throw new Error("Credenciais inválidas");
  }

  const senhaValida = await comparePassword(senha, usuario.senhaHash);

  if (!senhaValida) {
    throw new Error("Credenciais inválidas");
  }

  const perfis = usuario.perfis.map((usuarioPerfil) => usuarioPerfil.perfil.nome);
  const { secret, expiresIn } = getAuthConfig();

  const token = jwt.sign(
    {
      perfis,
    },
    secret,
    {
      subject: usuario.id,
      expiresIn,
    },
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfis,
    },
  };
}
