import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

const mocks = vi.hoisted(() => {
  return {
    multaFindUnique: vi.fn(),
    multaFindMany: vi.fn(),
    multaCount: vi.fn(),
    multaAggregate: vi.fn(),
    multaCreate: vi.fn(),
    multaUpdate: vi.fn(),
    veiculoFindUnique: vi.fn(),
    motoristaFindUnique: vi.fn(),
    solicitacaoFindUnique: vi.fn(),
    registrarAuditoria: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    multaInfracao: {
      findUnique: mocks.multaFindUnique,
      findMany: mocks.multaFindMany,
      count: mocks.multaCount,
      aggregate: mocks.multaAggregate,
      create: mocks.multaCreate,
      update: mocks.multaUpdate,
    },
    veiculo: { findUnique: mocks.veiculoFindUnique },
    motorista: { findUnique: mocks.motoristaFindUnique },
    solicitacaoViagem: { findUnique: mocks.solicitacaoFindUnique },
  },
}));

vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "segredo-sintetico-multas", expiresIn: 28800 }),
}));

import { app } from "../../../src/app";

const adminId = "00000000-0000-4000-8000-0000000000a1";
const gestorId = "00000000-0000-4000-8000-0000000000g1";
const motoristaUsuarioId = "00000000-0000-4000-8000-0000000000m1";
const veiculoId = "00000000-0000-4000-8000-000000000001";
const multaId = "00000000-0000-4000-8000-000000000002";

describe("Rotas de Multas e Infrações (/api/v1/multas)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita acesso de MOTORISTA com 403", async () => {
    const token = signTestToken({ perfis: ["MOTORISTA"] }, "segredo-sintetico-multas", {
      subject: motoristaUsuarioId,
    });

    const response = await fetch(`${baseUrl}/api/v1/multas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });

  it("permite listagem por GESTOR com 200", async () => {
    const token = signTestToken({ perfis: ["GESTOR"] }, "segredo-sintetico-multas", {
      subject: gestorId,
    });
    mocks.multaFindMany.mockResolvedValue([]);
    mocks.multaCount.mockResolvedValue(0);
    mocks.multaAggregate.mockResolvedValue({ _sum: { valor: null, pontos: null } });

    const response = await fetch(`${baseUrl}/api/v1/multas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("cadastra nova multa via POST com 201 para ADMIN", async () => {
    const token = signTestToken({ perfis: ["ADMIN"] }, "segredo-sintetico-multas", {
      subject: adminId,
    });
    mocks.multaFindUnique.mockResolvedValue(null);
    mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: true });
    mocks.multaCreate.mockResolvedValue({
      id: multaId,
      autoInfracao: "AUTO-ROTA-101",
      veiculoId,
      motoristaId: null,
      solicitacaoId: null,
      dataHora: new Date("2026-11-04T12:00:00Z"),
      gravidade: "MEDIA",
      pontos: 4,
      valor: 130.16,
      status: "PENDENTE",
      veiculo: { placa: "ABC1D23", modelo: "Chevrolet Spin" },
      motorista: null,
    });

    const response = await fetch(`${baseUrl}/api/v1/multas`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        autoInfracao: "AUTO-ROTA-101",
        veiculoId,
        dataHora: "2026-11-04T12:00:00Z",
        gravidade: "MEDIA",
        valor: 130.16,
        status: "PENDENTE",
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(multaId);
    expect(body.autoInfracao).toBe("AUTO-ROTA-101");
  });

  it("atualiza multa via PATCH com 200", async () => {
    const token = signTestToken({ perfis: ["ADMIN"] }, "segredo-sintetico-multas", {
      subject: adminId,
    });
    mocks.multaFindUnique.mockResolvedValue({ id: multaId, status: "PENDENTE" });
    mocks.multaUpdate.mockResolvedValue({
      id: multaId,
      autoInfracao: "AUTO-ROTA-101",
      status: "PAGA",
      valor: 130.16,
      veiculo: { placa: "ABC1D23", modelo: "Spin" },
      motorista: null,
    });

    const response = await fetch(`${baseUrl}/api/v1/multas/${multaId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "PAGA",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("PAGA");
  });
});
