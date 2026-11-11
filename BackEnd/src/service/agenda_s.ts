import { z } from "zod";
import { prisma } from "../lib/prisma";
import { historicoProgramacoes } from "./programacao_manutencao_s";

const diaMs = 86_400_000;
const inicioDoDia = (data: string) => new Date(`${data}T00:00:00-03:00`);
const diaSeguinte = (data: Date) => new Date(data.getTime() + diaMs);

export const agendaSchema = z
  .object({ inicio: z.iso.date(), fim: z.iso.date() })
  .refine(({ inicio, fim }) => inicio <= fim, {
    path: ["fim"],
    message: "A data final deve ser igual ou posterior à inicial.",
  });

export async function consultarAgenda({ inicio, fim }: z.infer<typeof agendaSchema>) {
  const de = inicioDoDia(inicio);
  const ate = diaSeguinte(inicioDoDia(fim));
  const frota = { tipoFrota: "ADMINISTRATIVA" };
  const reserva = {
    status: { in: ["APROVADA", "EM_TRANSITO"] },
    dataHoraPretendida: { lt: ate },
    dataHoraRetornoPrevista: { gt: de },
  };

  const [veiculos, motoristas, viagens, manutencoes] = await prisma.$transaction(
    [
      prisma.veiculo.findMany({
        where: { ...frota, OR: [{ ativo: true }, { solicitacoes: { some: reserva } }] },
        select: { id: true, placa: true, modelo: true },
        orderBy: { placa: "asc" },
      }),
      prisma.motorista.findMany({
        where: {
          OR: [{ ativo: true }, { solicitacoes: { some: { ...reserva, veiculoAlocado: frota } } }],
        },
        select: { id: true, usuario: { select: { nome: true } }, numeroCnh: true },
        orderBy: [{ usuario: { nome: "asc" } }, { id: "asc" }],
      }),
      prisma.solicitacaoViagem.findMany({
        where: { ...reserva, veiculoAlocado: frota },
        select: {
          id: true,
          protocolo: true,
          status: true,
          dataHoraPretendida: true,
          dataHoraRetornoPrevista: true,
          veiculoAlocadoId: true,
          motoristaAlocadoId: true,
        },
      }),
      prisma.manutencao.findMany({
        where: {
          veiculo: frota,
          OR: [
            { inicioPrevisto: { lt: ate }, fimPrevisto: { gt: de } },
            {
              inicioPrevisto: null,
              dataManutencao: { lte: new Date(`${fim}T00:00:00Z`) },
              OR: [
                { dataManutencao: { gte: new Date(`${inicio}T00:00:00Z`) } },
                { tipo: "CORRETIVA", status: "ABERTA" },
                { tipo: "CORRETIVA", dataConclusao: { gt: de } },
              ],
            },
          ],
        },
        select: {
          id: true,
          veiculoId: true,
          tipo: true,
          descricao: true,
          status: true,
          dataManutencao: true,
          dataConclusao: true,
          inicioPrevisto: true,
          fimPrevisto: true,
          fornecedor: { select: { razaoSocial: true } },
          veiculo: { select: { id: true, placa: true, modelo: true } },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );

  const historico = await historicoProgramacoes(
    manutencoes.filter((item) => item.inicioPrevisto).map(({ id }) => id),
  );
  const veiculosPorId = new Map(veiculos.map((veiculo) => [veiculo.id, veiculo]));
  const ocupacoes = [
    ...viagens.flatMap((viagem) => {
      const { dataHoraPretendida, dataHoraRetornoPrevista } = viagem;
      if (
        !dataHoraPretendida ||
        !dataHoraRetornoPrevista ||
        dataHoraPretendida >= dataHoraRetornoPrevista
      )
        return [];
      return [
        {
          tipo: "VIAGEM",
          id: viagem.id,
          inicio: dataHoraPretendida,
          fim: dataHoraRetornoPrevista,
          veiculoId: viagem.veiculoAlocadoId,
          motoristaId: viagem.motoristaAlocadoId,
          protocolo: viagem.protocolo,
          status: viagem.status,
        },
      ];
    }),
    ...manutencoes.flatMap((manutencao) => {
      const inicio =
        manutencao.inicioPrevisto ??
        (manutencao.dataManutencao
          ? inicioDoDia(manutencao.dataManutencao.toISOString().slice(0, 10))
          : null);
      if (!inicio) return [];
      const fim =
        manutencao.fimPrevisto ??
        (manutencao.tipo === "CORRETIVA"
          ? (manutencao.dataConclusao ??
            (manutencao.status === "ABERTA" ? ate : diaSeguinte(inicio)))
          : diaSeguinte(inicio));
      if (inicio >= fim || fim <= de) return [];
      veiculosPorId.set(manutencao.veiculoId, manutencao.veiculo);
      return [
        {
          tipo: "MANUTENCAO",
          id: manutencao.id,
          inicio,
          fim,
          veiculoId: manutencao.veiculoId,
          motoristaId: null,
          motivo: manutencao.descricao?.trim() || manutencao.tipo,
          status: manutencao.status,
          bloqueia: manutencao.status !== "CANCELADA",
          oficina: manutencao.fornecedor?.razaoSocial ?? null,
          historico: historico.get(manutencao.id) ?? [],
        },
      ];
    }),
  ].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  return {
    inicio: de,
    fim: ate,
    veiculos: [...veiculosPorId.values()],
    motoristas: motoristas.map(({ id, usuario, numeroCnh }) => ({
      id,
      nome: usuario?.nome ?? `Motorista (CNH final ${numeroCnh.slice(-4)})`,
    })),
    ocupacoes,
  };
}
