import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
const mocks = vi.hoisted(() => ({
  execucoes: vi.fn(),
  abastecimentos: vi.fn(),
  count: vi.fn(),
  viagens: vi.fn(),
  manutencoes: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    execucaoViagem: { findMany: mocks.execucoes },
    abastecimento: { findMany: mocks.abastecimentos },
    solicitacaoViagem: { count: mocks.count, groupBy: mocks.viagens },
    manutencao: { groupBy: mocks.manutencoes },
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
  mocks.viagens.mockResolvedValue([]);
  mocks.manutencoes.mockResolvedValue([]);
});
function consultar(query: string, perfis?: string[], caminho = "") {
  return fetch(`${baseUrl}/api/v1/relatorios${caminho}?${query}`, {
    headers: perfis
      ? {
          authorization: `Bearer ${signTestToken({ perfis }, "relatorio-test", { subject: "usuario" })}`,
        }
      : {},
  });
}
const query = "inicio=2026-10-01&fim=2026-10-30";
describe("Relatórios agregados", () => {
  it.each(["/consumo", "/manutencoes", "/viagens"])("protege e valida %s", async (rota) => {
    expect((await consultar(query, undefined, rota)).status).toBe(401);
    expect((await consultar(query, ["SOLICITANTE"], rota)).status).toBe(403);
    expect((await consultar("inicio=invalido", ["ADMIN"], rota)).status).toBe(400);
    expect((await consultar(`${query}&formato=x`, ["ADMIN"], rota)).status).toBe(400);
  });
  it("agrupa viagens pelo setor e status, com filtro exato", async () => {
    mocks.viagens.mockResolvedValue([
      { setorOrigem: "Laboratório", status: "CONCLUIDA", _count: { _all: 3 } },
    ]);
    const resposta = await consultar(`${query}&setor=Laborat%C3%B3rio`, ["GESTOR"], "/viagens");
    expect(await resposta.json()).toMatchObject({
      dados: [{ setor: "Laboratório", status: "CONCLUIDA", viagens: 3 }],
    });
    expect(mocks.viagens).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          setorOrigem: "Laboratório",
          dataHoraPretendida: {
            gte: new Date("2026-10-01T03:00:00Z"),
            lt: new Date("2026-10-31T03:00:00Z"),
          },
        },
      }),
    );
  });
  it("agrega manutenção por data civil UTC, tipo e status", async () => {
    mocks.manutencoes.mockResolvedValue([
      {
        tipo: "PREVENTIVA",
        status: "CONCLUIDA",
        _count: { _all: 2 },
        _sum: { custoTotal: "250.50" },
      },
    ]);
    const resposta = await consultar(query, ["ADMIN"], "/manutencoes");
    expect(await resposta.json()).toMatchObject({ dados: [{ quantidade: 2, custoTotal: 250.5 }] });
    expect(mocks.manutencoes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dataManutencao: { gte: new Date("2026-10-01Z"), lt: new Date("2026-10-31Z") } },
      }),
    );
    expect((await consultar(`${query}&setor=TI`, ["ADMIN"], "/manutencoes")).status).toBe(400);
  });
  it("calcula km/L e retorna null sem litros", async () => {
    const veiculo = { id: "v1", placa: "ABC1234", modelo: "Modelo", tipoFrota: "ADMINISTRATIVA" };
    mocks.execucoes.mockResolvedValue([
      { kmInicial: 100, kmFinal: 200, solicitacao: { veiculoAlocado: veiculo } },
    ]);
    mocks.abastecimentos.mockResolvedValue([{ veiculo, litros: 10 }]);
    expect(await (await consultar(query, ["ADMIN"], "/consumo")).json()).toMatchObject({
      dados: [{ consumoMedioKmL: 10 }],
    });
    mocks.abastecimentos.mockResolvedValue([]);
    expect(await (await consultar(query, ["ADMIN"], "/consumo")).json()).toMatchObject({
      dados: [{ consumoMedioKmL: null }],
    });
  });
  it("exporta CSV com escape e proteção contra fórmulas", async () => {
    mocks.viagens.mockResolvedValue([
      { setorOrigem: '=SUM(1;2)"', status: "CONCLUIDA", _count: { _all: 1 } },
    ]);
    const resposta = await consultar(`${query}&formato=csv`, ["ADMIN"], "/viagens");
    expect(resposta.headers.get("content-type")).toContain("text/csv");
    expect(resposta.headers.get("content-disposition")).toContain(".csv");
    expect(await resposta.text()).toContain('"\'=SUM(1;2)"""');
  });
  it("exporta PDF mesmo sem registros", async () => {
    const resposta = await consultar(`${query}&formato=pdf`, ["GESTOR"], "/manutencoes");
    expect(resposta.headers.get("content-type")).toContain("application/pdf");
    const pdf = Buffer.from(await resposta.arrayBuffer()).toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("%%EOF");
  });
  it("exporta PDF com várias páginas e caracteres fora da fonte padrão", async () => {
    mocks.viagens.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        setorOrigem: `Setor ${i} 🚗`,
        status: "CONCLUIDA",
        _count: { _all: 1 },
      })),
    );
    const resposta = await consultar(`${query}&formato=pdf`, ["ADMIN"], "/viagens");
    expect(resposta.status).toBe(200);
    const pdf = await PDFDocument.load(await resposta.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
describe.each(["", "/operacional"])("GET /api/v1/relatorios%s", (caminho) => {
  const consultarRota = (periodo: string, perfis?: string[]) => consultar(periodo, perfis, caminho);
  it("exige autenticação e perfil de gestão", async () => {
    expect((await consultarRota(query)).status).toBe(401);
    expect((await consultarRota(query, ["SOLICITANTE"])).status).toBe(403);
    expect(mocks.execucoes).not.toHaveBeenCalled();
  });
  it.each(["MOTORISTA", "SVO", "ATENDENTE_SVO"])("recusa o perfil %s", async (perfil) => {
    expect((await consultarRota(query, [perfil])).status).toBe(403);
    expect(mocks.execucoes).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "inicio=2026-02-30&fim=2026-03-01",
    "inicio=2026-10-30&fim=2026-10-01",
    "inicio=abc&fim=2026-10-30",
    "inicio=2026-10-01",
    "fim=2026-10-30",
    "inicio=2026-10-01&inicio=2026-10-02&fim=2026-10-30",
  ])("rejeita período inválido: %s", async (valor) => {
    expect((await consultarRota(valor, ["ADMIN"])).status).toBe(400);
    expect(mocks.execucoes).not.toHaveBeenCalled();
  });
  it("aceita um único dia e aplica o período a todas as consultas", async () => {
    const response = await consultarRota("inicio=2026-12-31&fim=2026-12-31", ["GESTOR"]);
    expect(response.status).toBe(200);
    const intervalo = {
      gte: new Date("2026-12-31T03:00:00Z"),
      lt: new Date("2027-01-01T03:00:00Z"),
    };
    expect(mocks.execucoes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dataHoraFim: intervalo },
      }),
    );
    expect(mocks.abastecimentos).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dataHora: intervalo },
      }),
    );
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        status: { in: ["PENDENTE", "APROVADA", "EM_TRANSITO"] },
        dataHoraPretendida: intervalo,
      },
    });
  });
  it("retorna erro sem expor detalhes quando o banco falha", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execucoes.mockRejectedValueOnce(new Error("detalhe privado do banco"));
    try {
      const response = await consultarRota(query, ["ADMIN"]);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        message:
          "O sistema não conseguiu concluir a operação. Tente novamente em alguns instantes.",
      });
    } finally {
      log.mockRestore();
    }
  });
  it("retorna vazio e desvio indisponível sem inventar registros", async () => {
    const response = await consultarRota(query, ["GESTOR"]);
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
    const response = await consultarRota(query, ["ADMIN"]);
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
