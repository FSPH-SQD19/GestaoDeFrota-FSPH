import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  motorista: { findUnique: vi.fn(), update: vi.fn() },
  saidaOperacional: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  comandoSaida: { findUnique: vi.fn(), create: vi.fn() },
  veiculo: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  saidaOrdem: { update: vi.fn() },
  ordemColetaSvo: { updateMany: vi.fn() },
  desinfeccaoSvo: { create: vi.fn() },
  abastecimento: { findFirst: vi.fn() },
  auditoriaSistema: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({ prisma: db }));
import {
  checklistSchema,
  checklistImpedeSaida,
  inicioSchema,
  posicoesSchema,
} from "../../../src/service/diario_rules";
import {
  saidaAutorizada,
  iniciarSaida,
  executarComando,
  registrarPosicoes,
  calcularRota,
} from "../../../src/service/diario_s";
const usuario = { id: randomUUID(), perfis: ["MOTORISTA"] },
  motoristaId = randomUUID(),
  veiculoId = randomUUID(),
  id = randomUUID();
const checklist = () =>
  checklistSchema.parse({
    versao: 1,
    itens: Object.fromEntries(
      ["pneus", "iluminacao", "freios", "fluidos", "equipamentos", "limpeza"].map((k) => [
        k,
        { estado: "CONFORME" },
      ]),
    ),
  });
const saida = () => ({
  id,
  motoristaId,
  veiculoId,
  tipo: "ADMINISTRATIVA",
  status: "EM_ANDAMENTO",
  inicio: new Date(Date.now() - 60000),
  kmInicial: new Prisma.Decimal(100),
  fim: null,
  ordens: [],
  pontos: [{ id: "destino", nome: "Destino", coordenadas: [-37, -10.9] }],
});
beforeEach(() => {
  vi.resetAllMocks();
  db.motorista.findUnique.mockResolvedValue({ id: motoristaId, ativo: true });
  db.saidaOperacional.findUnique.mockResolvedValue(saida());
  db.saidaOperacional.findUniqueOrThrow.mockResolvedValue(saida());
  db.$transaction.mockImplementation((fn) => fn(db));
});
describe("diário de bordo", () => {
  it("SVO respeita a sequência e só inicia desinfecção depois de todas as visitas no retorno", async () => {
    const ordem1 = randomUUID(),
      ordem2 = randomUUID();
    const registro = {
      ...saida(),
      tipo: "SVO",
      ordens: [
        { ordemId: ordem1, visitadaEm: null as Date | null },
        { ordemId: ordem2, visitadaEm: null as Date | null },
      ],
      pontos: [
        { id: ordem1, nome: "Coleta 1", coordenadas: null },
        { id: ordem2, nome: "Coleta 2", coordenadas: null },
        { id: "base", nome: "Base", coordenadas: null },
      ],
    };
    db.saidaOperacional.findUnique.mockResolvedValue(registro);
    db.saidaOperacional.findUniqueOrThrow.mockResolvedValue(registro);
    db.saidaOrdem.update.mockImplementation(async ({ where }) => {
      registro.ordens.find((o) => o.ordemId === where.ordemId)!.visitadaEm = new Date();
    });
    db.veiculo.findUniqueOrThrow.mockResolvedValue({ odometroAtual: new Prisma.Decimal(100) });
    db.abastecimento.findFirst.mockResolvedValue(null);
    await expect(
      executarComando(id, { id: randomUUID(), tipo: "VISITA", ordemId: ordem2 }, usuario),
    ).rejects.toMatchObject({ statusCode: 409 });
    await executarComando(id, { id: randomUUID(), tipo: "VISITA", ordemId: ordem1 }, usuario);
    const fim = {
      id: randomUUID(),
      tipo: "ENCERRAR" as const,
      kmFinal: 120,
      checklist: checklist(),
      ocorrencias: "",
      dataHora: new Date().toISOString(),
    };
    await expect(executarComando(id, fim, usuario)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.desinfeccaoSvo.create).not.toHaveBeenCalled();
    await executarComando(id, { id: randomUUID(), tipo: "VISITA", ordemId: ordem2 }, usuario);
    await executarComando(id, fim, usuario);
    expect(db.desinfeccaoSvo.create).toHaveBeenCalledOnce();
    expect(db.veiculo.update).toHaveBeenCalledWith({
      where: { id: veiculoId },
      data: { status: "DESINFECCAO", odometroAtual: 120 },
    });
  });
  it("não conclui com odômetro anterior ao abastecimento e não grava comando rejeitado", async () => {
    db.veiculo.findUniqueOrThrow.mockResolvedValue({ odometroAtual: new Prisma.Decimal(100) });
    db.abastecimento.findFirst.mockResolvedValue({ odometro: new Prisma.Decimal(110) });
    await expect(
      executarComando(
        id,
        {
          id: randomUUID(),
          tipo: "ENCERRAR",
          kmFinal: 105,
          checklist: checklist(),
          ocorrencias: "",
          dataHora: new Date().toISOString(),
        },
        usuario,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(db.comandoSaida.create).not.toHaveBeenCalled();
  });

  it("recusa saída alheia e permite gestão somente na própria operação", async () => {
    db.motorista.findUnique.mockResolvedValue({ id: randomUUID(), ativo: true });
    await expect(saidaAutorizada(id, usuario)).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      saidaAutorizada(id, { id: randomUUID(), perfis: ["GESTOR"] }, true),
    ).resolves.toMatchObject({ id });
    await expect(
      saidaAutorizada(id, { id: randomUUID(), perfis: ["SVO"] }, true),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("exige observação e bloqueia falha crítica antes de iniciar transação", async () => {
    const c = checklist();
    c.itens.freios = { estado: "PROBLEMA", observacao: "Falha no pedal" };
    expect(checklistImpedeSaida(c)).toBe(true);
    await expect(
      iniciarSaida(
        {
          id,
          tipo: "ADMINISTRATIVA",
          tarefaId: randomUUID(),
          veiculoId,
          kmInicial: 10,
          checklist: c,
        },
        usuario,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(db.$transaction).not.toHaveBeenCalled();
    c.itens.freios.observacao = "";
    expect(checklistSchema.safeParse(c).success).toBe(false);
  });
  it("aceita problema não crítico documentado e valida versão do checklist", () => {
    const c = checklist();
    c.itens.limpeza = { estado: "PROBLEMA", observacao: "Banco manchado" };
    expect(checklistImpedeSaida(c)).toBe(false);
    expect(checklistSchema.safeParse({ ...c, versao: 2 }).success).toBe(false);
    expect(
      inicioSchema.safeParse({
        id,
        tipo: "SVO",
        tarefaId: randomUUID(),
        veiculoId,
        kmInicial: -1,
        checklist: c,
      }).success,
    ).toBe(false);
  });
  it("reenvio semântico de comando já concluído não repete efeitos", async () => {
    const comando = { id: randomUUID(), tipo: "VISITA" as const, ordemId: randomUUID() };
    db.comandoSaida.findUnique.mockResolvedValue({
      saidaId: id,
      payload: { ordemId: comando.ordemId, tipo: comando.tipo, id: comando.id },
    });
    db.saidaOperacional.findUniqueOrThrow.mockResolvedValue({ ...saida(), status: "CONCLUIDA" });
    await expect(executarComando(id, comando, usuario)).resolves.toMatchObject({
      status: "CONCLUIDA",
    });
    expect(db.comandoSaida.create).not.toHaveBeenCalled();
  });
  it("recusa reutilização de UUID com payload diferente", async () => {
    const comando = { id: randomUUID(), tipo: "VISITA" as const, ordemId: randomUUID() };
    db.comandoSaida.findUnique.mockResolvedValue({
      saidaId: id,
      payload: { ...comando, ordemId: randomUUID() },
    });
    await expect(executarComando(id, comando, usuario)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("reenvia início somente para os mesmos vínculos", async () => {
    const tarefaId = randomUUID();
    db.saidaOperacional.findUnique.mockResolvedValue({ ...saida(), solicitacaoId: tarefaId });
    await expect(
      iniciarSaida(
        { id, tipo: "ADMINISTRATIVA", tarefaId, veiculoId, kmInicial: 10, checklist: checklist() },
        usuario,
      ),
    ).resolves.toMatchObject({ id });
    await expect(
      iniciarSaida(
        {
          id,
          tipo: "ADMINISTRATIVA",
          tarefaId: randomUUID(),
          veiculoId,
          kmInicial: 10,
          checklist: checklist(),
        },
        usuario,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("limita lotes e valida ordem longitude/latitude", () => {
    const p = {
      id: randomUUID(),
      coordenadas: [-37, -10.9],
      capturadaEm: new Date().toISOString(),
      precisao: 12,
    };
    expect(posicoesSchema.safeParse({ posicoes: [p] }).success).toBe(true);
    expect(
      posicoesSchema.safeParse({ posicoes: [{ ...p, coordenadas: [-37, 100] }] }).success,
    ).toBe(false);
    expect(posicoesSchema.safeParse({ posicoes: Array(51).fill(p) }).success).toBe(false);
  });
  it("não atualiza última posição quando UUID já foi recebido", async () => {
    db.$executeRaw.mockResolvedValue(0);
    await registrarPosicoes(
      id,
      {
        posicoes: [
          {
            id: randomUUID(),
            coordenadas: [-37, -10.9],
            capturadaEm: new Date().toISOString(),
            precisao: 12,
          },
        ],
      },
      usuario,
    );
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("recusa amostra após o retorno", async () => {
    db.saidaOperacional.findUniqueOrThrow.mockResolvedValue({
      ...saida(),
      fim: new Date(Date.now() - 10000),
    });
    await expect(
      registrarPosicoes(
        id,
        {
          posicoes: [
            {
              id: randomUUID(),
              coordenadas: [-37, -10.9],
              capturadaEm: new Date().toISOString(),
              precisao: 12,
            },
          ],
        },
        usuario,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
  it("degrada sem OSRM ou coordenadas e não expõe credenciais", async () => {
    vi.stubEnv("OSRM_URL", "");
    await expect(calcularRota(id, [-37, -10.9], usuario)).rejects.toMatchObject({
      statusCode: 503,
    });
    db.saidaOperacional.findUnique.mockResolvedValue({
      ...saida(),
      pontos: [{ id: "destino", nome: "Destino", coordenadas: null }],
    });
    await expect(calcularRota(id, [-37, -10.9], usuario)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
  it("retorna instruções e GeoJSON do OSRM e trata NoRoute", async () => {
    vi.stubEnv("OSRM_URL", "https://osrm.example.test/");
    vi.stubEnv("OSRM_TOKEN", "segredo");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ code: "NoRoute" }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(calcularRota(id, [-37.1, -10.8], usuario)).rejects.toMatchObject({
        statusCode: 422,
      });
      fetcher.mockResolvedValue(
        Response.json({
          code: "Ok",
          routes: [
            {
              geometry: {
                type: "LineString",
                coordinates: [
                  [-37.1, -10.8],
                  [-37, -10.9],
                ],
              },
              distance: 1000,
              duration: 90,
              legs: [
                {
                  steps: [
                    {
                      name: "Rua A",
                      distance: 1000,
                      maneuver: { type: "turn", modifier: "right" },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );
      const result = await calcularRota(id, [-37.1, -10.8], usuario);
      expect(result.instrucoes[0].texto).toContain("à direita");
      expect(result).not.toHaveProperty("token");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
