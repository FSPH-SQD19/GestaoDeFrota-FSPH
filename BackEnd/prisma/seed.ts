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

  // 3. Buscar o usuário motorista criado acima.
  const usuarioMotorista = await prisma.usuario.findUniqueOrThrow({
    where: { email: "motorista@frota.com" },
  });

  // CPF válido para testes, armazenado apenas com dígitos.
  // CNH com 11 dígitos, conforme a validação usada pelo serviço.
  const cpfMotorista = "52998224725";
  const numeroCnhMotorista = "12345678901";
  const validadeCnhMotorista = new Date("2035-12-31T00:00:00.000Z");

  // 4. Criar ou atualizar o motorista de teste.
  await prisma.motorista.upsert({
    where: { cpf: cpfMotorista },
    update: {
      usuarioId: usuarioMotorista.id,
      numeroCnh: numeroCnhMotorista,
      categoriaCnh: "B",
      validadeCnh: validadeCnhMotorista,
      telefone: "(79) 99999-1234",
      status: "DISPONIVEL",
      ativo: true,
    },
    create: {
      usuarioId: usuarioMotorista.id,
      cpf: cpfMotorista,
      numeroCnh: numeroCnhMotorista,
      categoriaCnh: "B",
      validadeCnh: validadeCnhMotorista,
      telefone: "(79) 99999-1234",
      status: "DISPONIVEL",
      ativo: true,
    },
  });

  console.log("Motorista de teste criado/atualizado:");
  console.log("Nome: Motorista Teste");
  console.log("E-mail: motorista@frota.com");
  console.log(`CPF de teste: ${cpfMotorista}`);
  console.log(`CNH de teste: ${numeroCnhMotorista}`);
  console.log("Validade da CNH: 2035-12-31");
  console.log("Telefone: (79) 99999-1234");
  console.log("Status: DISPONIVEL");
  console.log("Ativo: true");

  console.log("\nSeed concluído com sucesso.");
  console.log("Credenciais de teste:");
  console.log("ADMIN: admin@frota.com / Admin@123");
  console.log("GESTOR: gestor@frota.com / Gestor@123");
  console.log("MOTORISTA: motorista@frota.com / Motorista@123");
  console.log("SVO: svo@frota.com / Svo@123");
}

main()
  .catch((erro: unknown) => {
    console.error("Erro ao executar seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });