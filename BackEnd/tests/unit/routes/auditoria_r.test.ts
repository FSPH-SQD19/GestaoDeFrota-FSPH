import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditoriaFindMany: vi.fn(),
  auditoriaCount: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    auditoriaSistema: {
      findMany: mocks.auditoriaFindMany,
      count: mocks.auditoriaCount,
    },
  },
}));

import { app } from "../../../src/app";

const secret = "chave-sintetica-dos-testes-de-auditoria";
const adminId = "00000000-0000-4000-8000-000000000001";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  vi.clearAllMocks();
});

const mockLog = {
  id: "00000000-0000-4000-8000-000000000001",
  usuarioId: adminId,
  acao: "CRIAR",
  tabelaAfetada: "solicitacoes_viagem",
  registroId: "00000000-0000-4000-8000-000000000002",
  dadosNovos: { protocolo: "SV-2026-0001", senhaHash: "$2a$10$hashsecreto" },
  criadoEm: new Date("2026-11-10T10:00:00Z"),
  usuario: {
    id: adminId,
    nome: "Admin Geral",
    email: "admin@fsph.se.gov.br",
    setor: "Tecnologia",
  },
};

describe("GET /api/v1/auditoria", () => {
  it("exige autenticação (retorna 401)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auditoria`);
    expect(res.status).toBe(401);
  });

  it("retorna 403 para perfil SOLICITANTE", async () => {
    const token = signTestToken({ perfis: ["SOLICITANTE"] }, secret, { subject: "user-1" });
    const res = await fetch(`${baseUrl}/api/v1/auditoria`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("retorna 403 para perfil GESTOR", async () => {
    const token = signTestToken({ perfis: ["GESTOR"] }, secret, { subject: "user-2" });
    const res = await fetch(`${baseUrl}/api/v1/auditoria`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("retorna 403 para perfil MOTORISTA", async () => {
    const token = signTestToken({ perfis: ["MOTORISTA"] }, secret, { subject: "user-3" });
    const res = await fetch(`${baseUrl}/api/v1/auditoria`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("permite acesso ao perfil ADMIN e retorna dados sanitizados LGPD", async () => {
    mocks.auditoriaFindMany.mockResolvedValue([mockLog]);
    mocks.auditoriaCount.mockResolvedValue(1);

    const token = signTestToken({ perfis: ["ADMIN"] }, secret, { subject: adminId });
    const res = await fetch(`${baseUrl}/api/v1/auditoria`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ acao: string; dadosNovos: Record<string, unknown> }>;
      meta: { total: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].acao).toBe("CRIAR");
    expect(body.data[0].dadosNovos.protocolo).toBe("SV-2026-0001");
    expect(body.data[0].dadosNovos.senhaHash).toBe("******");
    expect(body.meta.total).toBe(1);
  });

  it("repassa filtros de consulta na requisição", async () => {
    mocks.auditoriaFindMany.mockResolvedValue([]);
    mocks.auditoriaCount.mockResolvedValue(0);

    const token = signTestToken({ perfis: ["ADMIN"] }, secret, { subject: adminId });
    const res = await fetch(
      `${baseUrl}/api/v1/auditoria?tabelaAfetada=veiculos&acao=CRIAR&page=2&pageSize=10`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(res.status).toBe(200);
    expect(mocks.auditoriaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tabelaAfetada: "veiculos",
          acao: "CRIAR",
        }),
        skip: 10,
        take: 10,
      }),
    );
  });
});
