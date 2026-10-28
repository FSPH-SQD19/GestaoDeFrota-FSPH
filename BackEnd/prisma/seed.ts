import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/service/password_s";

const prisma = new PrismaClient();

const perfis = [
  { nome: "ADMIN", descricao: "Teste ADM" },
  { nome: "GESTOR", descricao: "Teste Gestor frota" },
  { nome: "MOTORISTA", descricao: "Teste motorista" },
  { nome: "SVO", descricao: "Teste SVO" },
];

const usuarios = [
  {
    nome: "Administrador Teste",
    email: "admin@frota.com",
    senha: "Admin@123",
    perfil: "ADMIN",
  },
  {
    nome: "Gestor Teste",
    email: "gestor@frota.com",
    senha: "Gestor@123",
    perfil: "GESTOR",
  },
  {
    nome: "Motorista Teste",
    email: "motorista@frota.com",
    senha: "Motorista@123",
    perfil: "MOTORISTA",
  },
  {
    nome: "SVO Teste",
    email: "svo@frota.com",
    senha: "Svo@123",
    perfil: "SVO",
  },
];

function mostrarBancoDestino() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("AVISO: DATABASE_URL não está definida no ambiente do seed.");
    return;
  }

  try {
    const url = new URL(connectionString);
    const banco = url.pathname.replace(/^\//, "") || "não informado";
    console.log(`Banco de destino do seed: ${url.hostname}:${url.port || "5432"}/${banco}`);
    console.log(`Usuário do banco: ${decodeURIComponent(url.username || "não informado")}`);
  } catch {
    console.warn("AVISO: DATABASE_URL existe, mas não pôde ser interpretada como URL.");
  }
}

async function main() {
  console.log("Iniciando seed...");
  mostrarBancoDestino();

  // 1. Criar ou atualizar os perfis.
  for (const dadosPerfil of perfis) {
    await prisma.perfil.upsert({
      where: { nome: dadosPerfil.nome },
      update: { descricao: dadosPerfil.descricao },
      create: dadosPerfil,
    });

    console.log(`Perfil criado/atualizado: ${dadosPerfil.nome}`);
  }

  // 2. Criar ou atualizar usuários e seus perfis.
  for (const dados of usuarios) {
    const senhaHash = await hashPassword(dados.senha);

    const usuario = await prisma.usuario.upsert({
      where: { email: dados.email },
      update: {
        nome: dados.nome,
        senhaHash,
        ativo: true,
      },
      create: {
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        ativo: true,
      },
    });

    const perfil = await prisma.perfil.findUniqueOrThrow({
      where: { nome: dados.perfil },
    });
}}