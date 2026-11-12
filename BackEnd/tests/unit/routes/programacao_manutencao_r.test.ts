import { signTestToken } from "../../helpers/auth";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  cancel: vi.fn(),
  conflicts: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../../../src/service/programacao_manutencao_s", async (original) => ({
  ...(await original<typeof import("../../../src/service/programacao_manutencao_s")>()),
  salvarProgramacao: mocks.save,
  cancelarProgramacao: mocks.cancel,
  conflitosProgramacao: mocks.conflicts,
  listarProgramacoes: mocks.list,
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "programacao-teste", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";
const id = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-000000000002";
const input = {
  veiculoId,
  inicioPrevisto: "2026-12-01T08:00:00-03:00",
  fimPrevisto: "2026-12-01T12:00:00-03:00",
};
let server: Server, url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/manutencoes`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ id, status: "PROGRAMADA" });
  mocks.cancel.mockResolvedValue({ id, status: "CANCELADA" });
  mocks.conflicts.mockResolvedValue({ viagens: [], manutencoes: [] });
  mocks.list.mockResolvedValue({ data: [], meta: { total: 0 } });
});
async function request(
  method: string,
  path: string,
  body?: unknown,
  perfis: string[] | null = ["GESTOR"],
) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(perfis
        ? {
            authorization: `Bearer ${signTestToken({ perfis }, "programacao-teste", { subject: id })}`,
          }
        : {}),
    },
    ...(body === undefined || method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
describe("rotas de programação preventiva", () => {
  it.each([
    ["GET", `/programacoes?veiculoId=${veiculoId}`],
    ["POST", "/programacoes"],
    ["POST", "/programacoes/conflitos"],
    ["PATCH", `/${id}/reagendar`],
    ["PATCH", `/${id}/cancelar`],
  ])("protege %s %s", async (method, path) => {
    expect((await request(method, path, input, null)).status).toBe(401);
    expect((await request(method, path, input, ["MOTORISTA"])).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it.each(["GESTOR", "ADMIN"])(
    "permite programação para %s com autoria da sessão",
    async (perfil) => {
      expect((await request("POST", "/programacoes", input, [perfil])).status).toBe(201);
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          veiculoId,
          inicioPrevisto: new Date(input.inicioPrevisto),
          fimPrevisto: new Date(input.fimPrevisto),
        }),
        id,
      );
    },
  );
  it("valida a janela antes de consultar conflitos", async () => {
    expect(
      (
        await request("POST", "/programacoes/conflitos", {
          ...input,
          fimPrevisto: input.inicioPrevisto,
        })
      ).status,
    ).toBe(400);
    expect(mocks.conflicts).not.toHaveBeenCalled();
  });
  it("reagenda informando a versão que foi consultada", async () => {
    expect((await request("PATCH", `/${id}/reagendar`, { ...input, versao: 0 })).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ veiculoId }), id, {
      id,
      versao: 0,
    });
  });
  it("exige versão no cancelamento", async () => {
    expect((await request("PATCH", `/${id}/cancelar`, {})).status).toBe(400);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect((await request("PATCH", `/${id}/cancelar`, { versao: 0 })).status).toBe(200);
    expect(mocks.cancel).toHaveBeenCalledWith(id, 0, id);
  });
  it("consulta conflitos e histórico sem cache", async () => {
    expect((await request("POST", "/programacoes/conflitos", input)).body).toEqual({
      viagens: [],
      manutencoes: [],
    });
    const response = await request("GET", `/programacoes?veiculoId=${veiculoId}`);
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ veiculoId, page: 1, pageSize: 10 });
  });
});
