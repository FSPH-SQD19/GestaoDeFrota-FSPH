import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const perfis = [
  { nome: "ADMIN", descricao: "Administrador do sistema" },
  { nome: "GESTOR", descricao: "Gestor da frota" },
  { nome: "MOTORISTA", descricao: "Motorista da frota" },
  { nome: "ATENDENTE_SVO", descricao: "Atendente do Serviço de Verificação de Óbitos" },
  { nome: "SOLICITANTE", descricao: "Solicitante de transporte institucional" },
];

async function main() {
  for (const perfil of perfis) {
    await prisma.perfil.upsert({
      where: { nome: perfil.nome },
      update: { descricao: perfil.descricao },
      create: perfil,
    });
  }
}

main()
  .catch((erro) => {
    console.error("Erro ao executar o seed:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
