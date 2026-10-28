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

async function main() {
  console.log("Iniciando seed...");

  // 1. Criar ou atualizar os perfis
  for (const dadosPerfil of perfis) {
    await prisma.perfil.upsert({
      where: { nome: dadosPerfil.nome },
      update: { descricao: dadosPerfil.descricao },
      create: dadosPerfil,
    });

    console.log(`Perfil criado/atualizado: ${dadosPerfil.nome}`);
  }

  // 2. Criar ou atualizar usuários e seus perfis
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

    await prisma.usuarioPerfil.upsert({
      where: {
        usuarioId_perfilId: {
          usuarioId: usuario.id,
          perfilId: perfil.id,
        },
      },
      update: {},
      create: {
        usuarioId: usuario.id,
        perfilId: perfil.id,
      },
    });

    console.log(`Usuário criado/atualizado: ${dados.email} (${dados.perfil})`);
  }

  // 3. Buscar o usuário motorista já criado
  const usuarioMotorista = await prisma.usuario.findUniqueOrThrow({
    where: { email: "motorista@frota.com" },
  });

  // 4. Criar ou atualizar o motorista de teste
  await prisma.motorista.upsert({
    where: { cpf: "123.456.789-09" },
    update: {
      usuarioId: usuarioMotorista.id,
      numeroCnh: "TESTE123456",
      categoriaCnh: "B",
      validadeCnh: new Date("2025-12-31T00:00:00.000Z"),
      telefone: "(79) 99999-1234",
      status: "DISPONIVEL",
      ativo: true,
    },
    create: {
      usuarioId: usuarioMotorista.id,
      cpf: "123.456.789-09",
      numeroCnh: "TESTE123456",
      categoriaCnh: "B",
      validadeCnh: new Date("2025-12-31T00:00:00.000Z"),
      telefone: "(79) 99999-1234",
      status: "DISPONIVEL",
      ativo: true,
    },
  });

  console.log("Motorista de teste criado/atualizado:");
  console.log("Nome: Motorista Teste");
  console.log("Telefone: (79) 99999-1234");
  console.log("Status no banco: DISPONIVEL");
  console.log("CNH vencida para teste de validação.");
}

main()
  .catch((erro) => {
    console.error("Erro ao executar seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
