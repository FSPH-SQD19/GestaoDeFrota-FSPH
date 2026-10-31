import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execucoes: vi.fn(), abastecimentos: vi.fn(), count: vi.fn() }));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    execucaoViagem: { findMany: mocks.execucoes },
    abastecimento: { findMany: mocks.abastecimentos },
    solicitacaoViagem: { count: mocks.count },
  },
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "relatorio-test", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";
let server: Server;
let baseUrl: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  mocks.execucoes.mockResolvedValue([]);
  mocks.abastecimentos.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
});
function consultar(query: string, perfis?: string[]) {
  return fetch(`${baseUrl}/api/v1/relatorios?${query}`, {
    headers: perfis
      ? {
          authorization: `Bearer ${signTestToken({ perfis }, "relatorio-test", { subject: "usuario" })}`,
        }
      : {},
  });
}
const query = "inicio=2026-10-01&fim=2026-10-30";
describe("GET /api/v1/relatorios", () => {
  it("exige autenticação e perfil de gestão", async () => {
    expect((await consultar(query)).status).toBe(401);
    expect((await consultar(query, ["SOLICITANTE"])).status).toBe(403);
    expect(mocks.execucoes).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "inicio=2026-02-30&fim=2026-03-01",
    "inicio=2026-10-30&fim=2026-10-01",
    "inicio=abc&fim=2026-10-30",
  ])("rejeita período inválido: %s", async (valor) => {
    expect((await consultar(valor, ["ADMIN"])).status).toBe(400);
    expect(mocks.execucoes).not.toHaveBeenCalled();
  });
  it("retorna vazio e desvio indisponível sem inventar registros", async () => {
    const response = await consultar(query, ["GESTOR"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kmRodados: 0,
      consumoEstimadoLitros: 0,
      viagensConcluidas: 0,
      desviosDeRota: null,
      veiculos: [],
      motoristas: [],
    });
  });
  it("agrega odômetros válidos, abastecimentos independentes e motoristas por id", async () => {
    const veiculo = { id: "v1", placa: "ABC1234", modelo: "Modelo", tipoFrota: "ADMINISTRATIVA" };
    const motorista = { id: "m1", usuario: { nome: "Condutor" } };
    const solicitacao = { veiculoAlocado: veiculo, motoristaAlocado: motorista };
    mocks.execucoes.mockResolvedValue([
      { kmInicial: "100", kmFinal: "150", solicitacao },
      { kmInicial: null, kmFinal: "200", solicitacao },
      { kmInicial: "200", kmFinal: "100", solicitacao },
    ]);
    mocks.abastecimentos.mockResolvedValue([
      { veiculo, litros: "12.5" },
      { veiculo: { ...veiculo, id: "v2", placa: "DEF5678" }, litros: "5" },
    ]);
    mocks.count.mockResolvedValue(2);
    const response = await consultar(query, ["ADMIN"]);
    const dados = await response.json();
    expect(dados).toMatchObject({
      kmRodados: 50,
      consumoEstimadoLitros: 17.5,
      viagensConcluidas: 3,
      viagensEmAberto: 2,
      motoristas: [{ id: "m1", operacoes: 3 }],
    });
    expect(dados.veiculos).toMatchObject([
      {
        id: "v1",
        operacoes: 3,
        kmRodados: 50,
        kmMedio: 50,
        consumoLitros: 12.5,
        consumoMedio: null,
      },
      { id: "v2", operacoes: 0, kmMedio: null, consumoLitros: 5 },
    ]);
    expect(mocks.execucoes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataHoraFim: {
            gte: new Date("2026-10-01T03:00:00Z"),
            lt: new Date("2026-10-31T03:00:00Z"),
          },
        },
      }),
    );
  });
  it("protege também a edição de veículos", async () => {
    const response = await fetch(`${baseUrl}/api/v1/veiculos/veiculo`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(401);
  });
});
