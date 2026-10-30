import { z } from "zod";
import { prisma } from "../lib/prisma";

export const periodoRelatorioSchema = z
  .object({
    inicio: z.iso.date(),
    fim: z.iso.date(),
  })
  .refine(({ inicio, fim }) => inicio <= fim, {
    message: "O início deve ser anterior ao fim.",
    path: ["fim"],
  });

export async function gerarRelatorio({ inicio, fim }: z.infer<typeof periodoRelatorioSchema>) {
  // Dias civis do Brasil; limite superior exclusivo inclui todo o último dia.
  const gte = new Date(`${inicio}T00:00:00-03:00`);
  const lt = new Date(new Date(`${fim}T00:00:00-03:00`).getTime() + 86400000);
  const [execucoes, abastecimentos, emAberto] = await Promise.all([
    prisma.execucaoViagem.findMany({
      where: { dataHoraFim: { gte, lt } },
      include: {
        solicitacao: {
          include: { veiculoAlocado: true, motoristaAlocado: { include: { usuario: true } } },
        },
      },
    }),
    prisma.abastecimento.findMany({ where: { dataHora: { gte, lt } }, include: { veiculo: true } }),
    prisma.solicitacaoViagem.count({
      where: {
        status: { in: ["PENDENTE", "APROVADA", "EM_TRANSITO"] },
        dataHoraPretendida: { gte, lt },
      },
    }),
  ]);
  type Linha = {
    id: string;
    codigo: string;
    descricao: string;
    operacoes: number;
    unidade: "viagens";
    kmRodados: number;
    kmMedio: number | null;
    consumoLitros: number;
    consumoMedio: number | null;
    destaque: boolean;
    kmInformados: number;
  };
  const veiculos = new Map<string, Linha>();
  const motoristas = new Map<
    string,
    { id: string; nome: string; operacoes: number; unidade: "viagens" }
  >();
  function linha(v: { id: string; placa: string; modelo: string; tipoFrota: string }) {
    if (!veiculos.has(v.id))
      veiculos.set(v.id, {
        id: v.id,
        codigo: v.placa,
        descricao: v.modelo,
        operacoes: 0,
        unidade: "viagens",
        kmRodados: 0,
        kmMedio: null,
        consumoLitros: 0,
        consumoMedio: null,
        destaque: v.tipoFrota === "SVO",
        kmInformados: 0,
      });
    return veiculos.get(v.id)!;
  }
  let kmRodados = 0;
  for (const execucao of execucoes) {
    const { veiculoAlocado, motoristaAlocado } = execucao.solicitacao;
    const km =
      execucao.kmInicial !== null &&
      execucao.kmFinal !== null &&
      Number(execucao.kmFinal) >= Number(execucao.kmInicial)
        ? Number(execucao.kmFinal) - Number(execucao.kmInicial)
        : null;
    kmRodados += km ?? 0;
    if (veiculoAlocado) {
      const v = linha(veiculoAlocado);
      v.operacoes++;
      v.kmRodados += km ?? 0;
      if (km !== null) v.kmInformados++;
    }
    if (motoristaAlocado) {
      const m = motoristas.get(motoristaAlocado.id) ?? {
        id: motoristaAlocado.id,
        nome: motoristaAlocado.usuario?.nome ?? "Motorista sem usuário vinculado",
        operacoes: 0,
        unidade: "viagens" as const,
      };
      m.operacoes++;
      motoristas.set(m.id, m);
    }
  }
  let consumoEstimadoLitros = 0;
  for (const abastecimento of abastecimentos) {
    const litros = Number(abastecimento.litros ?? 0);
    linha(abastecimento.veiculo).consumoLitros += litros;
    consumoEstimadoLitros += litros;
  }
  return {
    id: `${inicio}_${fim}`,
    rotulo: `${inicio} a ${fim}`,
    kmRodados,
    consumoEstimadoLitros,
    viagensConcluidas: execucoes.length,
    viagensEmAberto: emAberto,
    // O schema ainda não registra desvios nem quilometragem de coletas SVO.
    desviosDeRota: null,
    veiculos: [...veiculos.values()].map(({ kmInformados, ...v }) => ({
      ...v,
      kmMedio: kmInformados ? v.kmRodados / kmInformados : null,
    })),
    motoristas: [...motoristas.values()],
  };
}
