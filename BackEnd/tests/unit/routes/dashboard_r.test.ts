import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
const mocks = vi.hoisted(() => ({
  veiculosPorStatus: vi.fn(),
  listarSolicitacoes: vi.fn(),
  contarSolicitacoes: vi.fn(),
  solicitacoesPorStatus: vi.fn(),
  listarDocumentos: vi.fn(),
  listarMotoristas: vi.fn(),
  contarChamados: vi.fn(),
  consultarSla: vi.fn(),
  execucoesRelatorio: vi.fn(),
  abastecimentosRelatorio: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    veiculo: { groupBy: mocks.veiculosPorStatus },
    documentoVeiculo: { findMany: mocks.listarDocumentos },
    motorista: { findMany: mocks.listarMotoristas },
    chamadoSvo: { count: mocks.contarChamados },
    ordemColetaSvo: { findMany: mocks.consultarSla },
    execucaoViagem: { findMany: mocks.execucoesRelatorio },
    abastecimento: { findMany: mocks.abastecimentosRelatorio },
    solicitacaoViagem: {
      findMany: mocks.listarSolicitacoes,
      count: mocks.contarSolicitacoes,
      groupBy: mocks.solicitacoesPorStatus,
    },
  },
}));
import { app } from "../../../src/app";
import { getAuthConfig } from "../../../src/config/auth";

const secret = "chave-sintetica-exclusiva-dos-testes";
let server: Server;
let baseUrl: string;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  mocks.listarDocumentos.mockResolvedValue([]);
  mocks.listarMotoristas.mockResolvedValue([]);
  mocks.contarChamados.mockResolvedValue(0);
  mocks.consultarSla.mockResolvedValue([]);
  mocks.execucoesRelatorio.mockResolvedValue([]);
  mocks.abastecimentosRelatorio.mockResolvedValue([]);
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.veiculosPorStatus.mockResolvedValue([
    { tipoFrota: "ADMINISTRATIVA", ativo: true, status: "DISPONIVEL", _count: { _all: 120 } },
    { tipoFrota: "SVO", ativo: true, status: "DISPONIVEL", _count: { _all: 10 } },
    { tipoFrota: "SVO", ativo: true, status: "EM_VIAGEM", _count: { _all: 20 } },
    { tipoFrota: "ADMINISTRATIVA", ativo: true, status: "MANUTENCAO", _count: { _all: 5 } },
    { tipoFrota: "SVO", ativo: false, status: "DISPONIVEL", _count: { _all: 2 } },
  ]);
  mocks.listarSolicitacoes.mockResolvedValue([]);
  mocks.contarSolicitacoes.mockResolvedValue(400);
  mocks.solicitacoesPorStatus.mockResolvedValue([{ status: "PENDENTE", _count: { _all: 25 } }]);
});
function chamar(perfis?: string[]) {
  return fetch(`${baseUrl}/api/v1/dashboard/resumo`, {
    headers: perfis
      ? {
          authorization: `Bearer ${signTestToken({ perfis }, secret, { subject: "00000000-0000-4000-8000-000000000001" })}`,
        }
      : {},
  });
}

describe("GET /api/v1/dashboard/resumo", () => {
  it("exige autenticação", async () => {
    expect((await chamar()).status).toBe(401);
    expect(mocks.veiculosPorStatus).not.toHaveBeenCalled();
  });
  it("inclui relatório do mês local com quilometragem e abastecimentos reais", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T02:59:59Z"));
    const veiculo = { id: "v1", placa: "ABC1234", modelo: "Teste", tipoFrota: "ADMINISTRATIVA" };
    mocks.execucoesRelatorio.mockResolvedValue([
      {
        kmInicial: 100,
        kmFinal: 250,
        solicitacao: { veiculoAlocado: veiculo, motoristaAlocado: null },
      },
    ]);
    mocks.abastecimentosRelatorio.mockResolvedValue([{ veiculo, litros: 30 }]);
    try {
      const resposta = await chamar(["GESTOR"]);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({
        relatorioMes: {
          id: "2026-11-01_2026-11-06",
          kmRodados: 150,
          consumoEstimadoLitros: 30,
          veiculos: [{ codigo: "ABC1234", kmRodados: 150, consumoLitros: 30 }],
        },
      });
      expect(mocks.execucoesRelatorio).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dataHoraFim: {
              gte: new Date("2026-11-01T03:00:00Z"),
              lt: new Date("2026-11-07T03:00:00Z"),
            },
          },
        }),
      );
      expect(mocks.abastecimentosRelatorio).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dataHora: {
              gte: new Date("2026-11-01T03:00:00Z"),
              lt: new Date("2026-11-07T03:00:00Z"),
            },
          },
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("preserva os demais indicadores se o relatório mensal falhar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execucoesRelatorio.mockRejectedValueOnce(new Error("Consulta indisponível"));
    try {
      const resposta = await chamar(["ADMIN"]);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ veiculos: { total: 155 }, relatorioMes: null });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it.each(["MOTORISTA", "SOLICITANTE", "ATENDENTE_SVO"])("nega acesso para %s", async (perfil) => {
    expect((await chamar([perfil])).status).toBe(403);
    expect(mocks.veiculosPorStatus).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "GESTOR"])(
    "agrega toda a frota ativa para %s, inclusive acima de 100 veículos",
    async (perfil) => {
      const resposta = await chamar([perfil]);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({
        veiculos: {
          total: 155,
          totalGeral: 157,
          porStatus: { DISPONIVEL: 130, EM_VIAGEM: 20, MANUTENCAO: 5, DESINFECCAO: 0, INATIVO: 2 },
          porTipoFrota: {
            ADMINISTRATIVA: { total: 125, totalGeral: 125 },
            SVO: { total: 30, totalGeral: 32, porStatus: { INATIVO: 2 } },
          },
        },
        solicitacoes: { data: [], meta: { total: 400, porStatus: { PENDENTE: 25 } } },
        alertas: [],
        solicitacoesPendentes: 25,
        svo: {
          chamadosAtivos: 0,
          slaMedioRespostaMinutos: null,
          slaMedioEntregaMinutos: null,
        },
      });
      expect(mocks.veiculosPorStatus).toHaveBeenCalledWith({
        by: ["tipoFrota", "status", "ativo"],
        _count: { _all: true },
      });
      expect(mocks.listarSolicitacoes).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 6,
          skip: 0,
          orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        }),
      );
    },
  );
  it("consulta o dia local e inclui CNH vencida e documentos até o 30º dia", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T02:59:59Z"));
    const documento = (id: string, tipoDocumento: string, data: string) => ({
      id,
      tipoDocumento,
      veiculoId: "v1",
      dataVencimento: new Date(data),
      veiculo: { placa: "ABC1234" },
    });
    mocks.listarDocumentos.mockResolvedValue([
      documento("no-limite", "VISTORIA", "2026-12-06"),
      documento("fora-do-limite", "IPVA", "2026-12-07"),
      documento("vencido", "CRLV", "2026-11-05"),
    ]);
    mocks.listarMotoristas.mockResolvedValue([
      { id: "m1", validadeCnh: new Date("2026-11-05"), usuario: { nome: "Condutor DEMO" } },
    ]);
    mocks.contarSolicitacoes.mockImplementation(async ({ where }) =>
      where.dataHoraPretendida ? 3 : 400,
    );
    mocks.contarChamados.mockResolvedValue(4);
    mocks.consultarSla.mockResolvedValue([
      {
        chamado: { criadoEm: new Date("2026-11-06T10:00:00Z") },
        dataHoraSaida: new Date("2026-11-06T10:10:00Z"),
        dataHoraChegadaLocal: new Date("2026-11-06T10:17:30Z"),
        dataHoraEntregaSvo: new Date("2026-11-06T11:00:00Z"),
      },
    ]);
    try {
      const resposta = await chamar(["ADMIN"]);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({
        viagensDoDia: 3,
        svo: { chamadosAtivos: 4, slaMedioRespostaMinutos: 17.5, slaMedioEntregaMinutos: 60 },
        alertasOperacionais: {
          total: 3,
          cnh: [{ motoristaId: "m1", situacao: "VENCIDO" }],
          documentos: [
            { id: "vencido", diasParaVencer: -1 },
            { id: "no-limite", diasParaVencer: 30 },
          ],
        },
      });
      expect(mocks.contarSolicitacoes).toHaveBeenCalledWith({
        where: {
          dataHoraPretendida: {
            gte: new Date("2026-11-06T03:00:00Z"),
            lt: new Date("2026-11-07T03:00:00Z"),
          },
          status: { in: ["APROVADA", "EM_TRANSITO", "CONCLUIDA"] },
        },
      });
      expect(mocks.listarMotoristas).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ativo: true, validadeCnh: { lte: new Date("2026-12-06") } },
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("retorna todos os totais zerados quando não há veículos", async () => {
    mocks.veiculosPorStatus.mockResolvedValue([]);
    const resposta = await chamar(["GESTOR"]);
    expect(await resposta.json()).toMatchObject({
      veiculos: {
        total: 0,
        porStatus: { DISPONIVEL: 0, EM_VIAGEM: 0, MANUTENCAO: 0, DESINFECCAO: 0 },
      },
    });
  });
});
