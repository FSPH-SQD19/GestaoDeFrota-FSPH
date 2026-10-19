import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { comparePassword } from "./password_s";

interface LoginInput{
    email: string;
    senha: string;
}

export async function login({email, senha}: LoginInput){
    const usuario = await prisma.usuario.findUnique({
        where: {email},
        include: {
            perfis:{
                include: {
                    perfil: true
                }
            }
        }
    });

if(!usuario || !usuario.ativo){
    throw new Error("Credenciais inválidas");
}

const senhaValida = await comparePassword(
  senha,
  usuario.senhaHash
);

if(!senhaValida){
    throw new Error("Credenciais inválidas");
}

const perfis = usuario.perfis.map((usuarioPerfil) => usuarioPerfil.perfil.nome);
const secret = process.env.JWT_SECRET;
if(!secret){
    throw new Error("JWT_SECRET não definido");
}



const token = jwt.sign({
    perfis
}, secret,{
    subject: usuario.id,
    expiresIn: "8h"
}
);


return {
    token,
    usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfis,
    },
}
}
