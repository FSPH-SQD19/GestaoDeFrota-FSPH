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
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    veiculo: { groupBy: mocks.veiculosPorStatus },
    documentoVeiculo: { findMany: mocks.listarDocumentos },
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
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.veiculosPorStatus.mockResolvedValue([
    { status: "DISPONIVEL", _count: { _all: 130 } },
    { status: "EM_VIAGEM", _count: { _all: 20 } },
    { status: "MANUTENCAO", _count: { _all: 5 } },
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
          porStatus: { DISPONIVEL: 130, EM_VIAGEM: 20, MANUTENCAO: 5, DESINFECCAO: 0 },
        },
        solicitacoes: { data: [], meta: { total: 400, porStatus: { PENDENTE: 25 } } },
        alertas: [],
      });
      expect(mocks.veiculosPorStatus).toHaveBeenCalledWith({
        by: ["status"],
        where: { ativo: true },
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
