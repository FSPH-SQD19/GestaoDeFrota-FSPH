import { z } from "zod";
import { prisma } from "../lib/prisma";
import { gerarRelatorio, periodoRelatorioSchema } from "./relatorio_s";

export const filtroAgregacaoSchema = z
  .object({
    inicio: z.iso.date(),
    fim: z.iso.date(),
    setor: z.string().trim().min(1).max(100).optional(),
    formato: z.enum(["json", "csv", "pdf"]).default("json"),
  })
  .refine(({ inicio, fim }) => inicio <= fim, {
    path: ["fim"],
    message: "O início deve ser anterior ao fim.",
  });

export type FiltroAgregacao = z.infer<typeof filtroAgregacaoSchema>;

export async function agregarViagens(filtro: FiltroAgregacao) {
  const gte = new Date(`${filtro.inicio}T00:00:00-03:00`);
  const lt = new Date(new Date(`${filtro.fim}T00:00:00-03:00`).getTime() + 86400000);
  const registros = await prisma.solicitacaoViagem.groupBy({
    by: ["setorOrigem", "status"],
    where: {
      dataHoraPretendida: { gte, lt },
      ...(filtro.setor ? { setorOrigem: filtro.setor } : {}),
    },
    _count: { _all: true },
    orderBy: [{ setorOrigem: "asc" }, { status: "asc" }],
  });
  return registros.map((r) => ({ setor: r.setorOrigem, status: r.status, viagens: r._count._all }));
}

export async function agregarManutencoes(filtro: FiltroAgregacao) {
  // dataManutencao é @db.Date: seus limites são datas UTC, não instantes UTC-03.
  const gte = new Date(`${filtro.inicio}T00:00:00Z`);
  const lt = new Date(new Date(`${filtro.fim}T00:00:00Z`).getTime() + 86400000);
  const registros = await prisma.manutencao.groupBy({
    by: ["tipo", "status"],
    where: { dataManutencao: { gte, lt } },
    _count: { _all: true },
    _sum: { custoTotal: true },
    orderBy: [{ tipo: "asc" }, { status: "asc" }],
  });
  return registros.map((r) => ({
    tipo: r.tipo,
    status: r.status,
    quantidade: r._count._all,
    custoTotal: Number(r._sum.custoTotal ?? 0),
  }));
}

export async function agregarConsumo(filtro: FiltroAgregacao) {
  const relatorio = await gerarRelatorio(periodoRelatorioSchema.parse(filtro));
  return relatorio.veiculos.map((v) => ({
    placa: v.codigo,
    modelo: v.descricao,
    kmRodados: v.kmRodados,
    litrosAbastecidos: v.consumoLitros,
    consumoMedioKmL:
      v.consumoLitros > 0 && v.kmMedio !== null ? v.kmRodados / v.consumoLitros : null,
  }));
}
