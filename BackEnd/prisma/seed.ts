import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";

const prisma = createPrismaClient(process.env.DATABASE_URL || "");

const perfis = [
  { nome: "ADMIN", descricao: "Administrador do sistema" },
  { nome: "GESTOR", descricao: "Gestor da frota" },
  { nome: "MOTORISTA", descricao: "Motorista da frota" },
  { nome: "SVO", descricao: "Atendente do Serviço de Verificação de Óbitos" },
  { nome: "SOLICITANTE", descricao: "Solicitante de transporte institucional" },
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
  } catch {
    console.warn("AVISO: DATABASE_URL existe, mas não pôde ser interpretada como URL.");
  }
}

async function main() {
  console.log("Iniciando seed de perfis de acesso...");
  mostrarBancoDestino();

  for (const perfil of perfis) {
    await prisma.perfil.upsert({
      where: { nome: perfil.nome },
      update: { descricao: perfil.descricao },
      create: perfil,
    });
    console.log(`Perfil criado/atualizado: ${perfil.nome}`);
  }

  console.log("Seed de perfis concluído com sucesso.");
}

main()
  .catch((erro: unknown) => {
    console.error("Erro ao executar seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
