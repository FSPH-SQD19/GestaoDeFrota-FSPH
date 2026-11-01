import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { checklistSchema } from "../../src/service/diario_rules";
import {
  iniciarSaida,
  executarComando,
  registrarPosicoes,
  percurso,
  ultimasPosicoes,
} from "../../src/service/diario_s";
import { emitirOrdemColetaSvo } from "../../src/service/svo_s";
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid/invalid");
if (
  process.env.DRIVER_INTEGRATION_ISOLATED !== "true" ||
  database.hostname !== "127.0.0.1" ||
  database.pathname !== "/rota_driver_test"
)
  throw new Error(
    "Execute somente pelo runner de PostGIS descartável: npm run test:integration:driver",
  );
const checklist = checklistSchema.parse({
  versao: 1,
  itens: Object.fromEntries(
    ["pneus", "iluminacao", "freios", "fluidos", "equipamentos", "limpeza"].map((k) => [
      k,
      { estado: "CONFORME" },
    ]),
  ),
});
afterAll(async () => {
  await prisma.$disconnect();
});
async function fixture(tipo: "SVO" | "ADMINISTRATIVA" = "ADMINISTRATIVA") {
  const key = randomUUID().replaceAll("-", "");
  const user = await prisma.usuario.create({
    data: { nome: "Integração", email: `${key}@test.invalid`, senhaHash: "synthetic" },
  });
  const motorista = await prisma.motorista.create({
    data: {
      usuarioId: user.id,
      cpf: key.slice(0, 14),
      numeroCnh: key.slice(0, 20),
      validadeCnh: new Date("2099-01-01"),
    },
  });
  const veiculo = await prisma.veiculo.create({
    data: {
      placa: key.slice(0, 8),
      modelo: "Integração",
      tipoFrota: tipo,
      capacidadeMaxima: 4,
      odometroAtual: 100,
    },
  });
  const usuario = { id: user.id, perfis: ["MOTORISTA"] };
  let tarefaId: string;
  if (tipo === "ADMINISTRATIVA") {
    const solicitacao = await prisma.solicitacaoViagem.create({
      data: {
        protocolo: key.slice(0, 20),
        solicitanteId: user.id,
        motoristaAlocadoId: motorista.id,
        veiculoAlocadoId: veiculo.id,
        status: "APROVADA",
        origem: "Base",
        destino: "Hospital",
        destinoCoordenadas: [-37, -10.9],
      },
    });
    tarefaId = solicitacao.id;
  } else {
    const chamado = await prisma.chamadoSvo.create({
      data: { atendenteId: user.id, statusTriagem: "APROVADO", enderecoOcorrencia: "Coleta" },
    });
    const ordem = await emitirOrdemColetaSvo(
      chamado.id,
      { motoristaId: motorista.id, veiculoId: veiculo.id },
      user.id,
    );
    tarefaId = ordem.id;
  }
  const input = {
    id: randomUUID(),
    tipo,
    tarefaId,
    veiculoId: veiculo.id,
    kmInicial: 100,
    checklist,
  };
  return { usuario, motorista, veiculo, input };
}
describe("PostGIS e transações reais em banco descartável", () => {
  it("deduplica início concorrente e bloqueia outro início para os mesmos recursos", async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([
      iniciarSaida(f.input, f.usuario),
      iniciarSaida(f.input, f.usuario),
    ]);
    expect(a.id).toBe(b.id);
    await expect(iniciarSaida({ ...f.input, id: randomUUID() }, f.usuario)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await prisma.saidaOperacional.count({ where: { motoristaId: f.motorista.id } })).toBe(1);
  });
  it("valida geometria, ordenação temporal, repetição e acesso por operação", async () => {
    const f = await fixture();
    const s = await iniciarSaida(f.input, f.usuario);
    const antiga = {
      id: randomUUID(),
      coordenadas: [-37.1, -10.9] as [number, number],
      capturadaEm: new Date(s.inicio.getTime() + 1).toISOString(),
      precisao: 15,
    };
    const nova = {
      ...antiga,
      id: randomUUID(),
      coordenadas: [-37.11, -10.91] as [number, number],
      capturadaEm: new Date(s.inicio.getTime() + 100).toISOString(),
    };
    await registrarPosicoes(s.id, { posicoes: [nova, antiga, nova] }, f.usuario);
    const points = (await percurso(s.id, { id: randomUUID(), perfis: ["GESTOR"] })) as Array<{
      coordenadas: number[];
    }>;
    expect(points).toHaveLength(2);
    expect(points[0].coordenadas).toEqual(antiga.coordenadas);
    const latest = (await ultimasPosicoes({ id: randomUUID(), perfis: ["GESTOR"] })) as Array<{
      saidaId: string;
      coordenadas: number[];
    }>;
    expect(latest.find((p) => p.saidaId === s.id)?.coordenadas).toEqual(nova.coordenadas);
    expect(
      (
        (await ultimasPosicoes({ id: randomUUID(), perfis: ["SVO"] })) as Array<{ saidaId: string }>
      ).some((p) => p.saidaId === s.id),
    ).toBe(false);
    const [distance] = await prisma.$queryRaw<
      Array<{ metros: number }>
    >`SELECT ST_Distance(ponto,ST_SetSRID(ST_MakePoint(-37.1,-10.9),4326)::geography) AS metros FROM posicoes_saida WHERE id=${antiga.id}::uuid`;
    expect(distance.metros).toBe(0);
  });
  it("salva combustível uma vez, rejeita odômetro regressivo e conclui o diário atomicamente", async () => {
    const f = await fixture();
    const s = await iniciarSaida(f.input, f.usuario);
    const fuel = {
      id: randomUUID(),
      tipo: "ABASTECIMENTO" as const,
      odometro: 110,
      litros: 10,
      valorTotal: 60,
      dataHora: new Date().toISOString(),
    };
    await Promise.all([
      executarComando(s.id, fuel, f.usuario),
      executarComando(s.id, fuel, f.usuario),
    ]);
    expect(await prisma.abastecimento.count({ where: { veiculoId: f.veiculo.id } })).toBe(1);
    const fim = {
      id: randomUUID(),
      tipo: "ENCERRAR" as const,
      kmFinal: 105,
      checklist,
      ocorrencias: "",
      dataHora: new Date().toISOString(),
    };
    await expect(executarComando(s.id, fim, f.usuario)).rejects.toMatchObject({ statusCode: 422 });
    expect(await prisma.comandoSaida.findUnique({ where: { id: fim.id } })).toBeNull();
    const final = { ...fim, kmFinal: 120 };
    await executarComando(s.id, final, f.usuario);
    await executarComando(s.id, final, f.usuario);
    expect(
      await prisma.solicitacaoViagem.findUnique({ where: { id: f.input.tarefaId } }),
    ).toMatchObject({ status: "CONCLUIDA" });
    expect(await prisma.veiculo.findUnique({ where: { id: f.veiculo.id } })).toMatchObject({
      status: "DISPONIVEL",
    });
  });
  it("mantém SVO aguardando despacho e exige visitas antes da desinfecção no retorno", async () => {
    const f = await fixture("SVO");
    expect(
      await prisma.ordemColetaSvo.findUnique({ where: { id: f.input.tarefaId } }),
    ).toMatchObject({ status: "AGUARDANDO_DESPACHO", dataHoraSaida: null });
    const s = await iniciarSaida(f.input, f.usuario);
    const fim = {
      id: randomUUID(),
      tipo: "ENCERRAR" as const,
      kmFinal: 130,
      checklist,
      ocorrencias: "",
      dataHora: new Date().toISOString(),
    };
    await expect(executarComando(s.id, fim, f.usuario)).rejects.toMatchObject({ statusCode: 409 });
    await executarComando(
      s.id,
      { id: randomUUID(), tipo: "VISITA", ordemId: f.input.tarefaId },
      f.usuario,
    );
    await executarComando(s.id, fim, f.usuario);
    expect(await prisma.veiculo.findUnique({ where: { id: f.veiculo.id } })).toMatchObject({
      status: "DESINFECCAO",
    });
    expect(
      await prisma.desinfeccaoSvo.count({
        where: { veiculoId: f.veiculo.id, status: "EM_ANDAMENTO" },
      }),
    ).toBe(1);
  });
});
