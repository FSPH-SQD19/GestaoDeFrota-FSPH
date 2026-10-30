import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  lookup: vi.fn(),
  vehicle: vi.fn(),
  vehicleResult: vi.fn(),
  supplier: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  vehicleUpdate: vi.fn(),
  release: vi.fn(),
  result: vi.fn(),
  count: vi.fn(),
  list: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
const tx = {
  $queryRaw: mocks.query,
  manutencao: {
    create: mocks.create,
    updateMany: mocks.update,
    findUnique: mocks.lookup,
    findUniqueOrThrow: mocks.result,
    count: mocks.count,
  },
  veiculo: {
    findUnique: mocks.vehicle,
    findUniqueOrThrow: mocks.vehicleResult,
    update: mocks.vehicleUpdate,
    updateMany: mocks.release,
  },
  fornecedor: { findUnique: mocks.supplier },
  auditoriaSistema: { create: mocks.audit },
};
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    manutencao: { findUnique: mocks.lookup, findMany: mocks.list, count: mocks.count },
  },
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "manutencao-teste", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";
const id = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-000000000002";
const input = {
  veiculoId,
  tipo: "CORRETIVA",
  odometroRegistro: 1500.25,
  custoTotal: 123.45,
  dataManutencao: "2026-10-30",
};
const registro = {
  ...input,
  id,
  status: "CONCLUIDA",
  dataManutencao: new Date("2026-10-30T00:00:00Z"),
  dataConclusao: new Date(),
  fornecedorId: null,
  descricao: null,
  odometroRegistro: new Prisma.Decimal("1500.25"),
  custoTotal: new Prisma.Decimal("123.45"),
};
let server: Server, url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue([{ locked: 1 }]);
  mocks.lookup.mockResolvedValue({ id, veiculoId });
  mocks.vehicle.mockResolvedValue({ ativo: true, status: "DISPONIVEL" });
  mocks.vehicleResult.mockResolvedValue({ status: "DISPONIVEL" });
  mocks.supplier.mockResolvedValue({ ativo: true });
  mocks.create.mockResolvedValue(registro);
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.release.mockResolvedValue({ count: 1 });
  mocks.result.mockResolvedValue(registro);
  mocks.count.mockResolvedValue(0);
  mocks.list.mockResolvedValue([registro]);
  mocks.transaction.mockImplementation((fn) => fn(tx));
});
async function request(
  method = "PATCH",
  path = `/${id}/concluir`,
  body?: unknown,
  perfis: string[] | null = ["GESTOR"],
) {
  const response = await fetch(`${url}/api/v1/manutencoes${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(perfis
        ? { authorization: `Bearer ${jwt.sign({ perfis }, "manutencao-teste", { subject: id })}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
describe("rotas existentes de manutenção", () => {
  it.each([
    ["GET", ""],
    ["POST", ""],
    ["PATCH", `/${id}/concluir`],
  ])("protege %s com autenticação e perfil", async (method, path) => {
    expect((await request(method, path, undefined, null)).status).toBe(401);
    expect((await request(method, path, undefined, ["MOTORISTA"])).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("lista com filtros e valores decimais serializados", async () => {
    mocks.count.mockResolvedValue(1);
    const response = await request(
      "GET",
      "?status=ABERTA&dataInicio=2026-10-01&dataFim=2026-10-30&pageSize=5",
    );
    expect(response.status).toBe(200);
    expect(response.body.data[0].custoTotal).toBe(123.45);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 5, total: 1, totalPages: 1 });
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ABERTA",
          dataManutencao: { gte: new Date("2026-10-01"), lte: new Date("2026-10-30") },
        }),
      }),
    );
  });
  it.each([
    "?status=INVALIDO",
    "?dataInicio=2026-02-30",
    "?dataInicio=2026-10-31&dataFim=2026-10-30",
    "?page=100000000000",
    "?pageSize=101",
  ])("rejeita filtro inválido %s", async (path) => {
    expect((await request("GET", path)).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each([null, true, 123, "2026-02-30"])("rejeita data inválida %s", async (dataManutencao) => {
    expect((await request("POST", "", { ...input, dataManutencao })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("registra corretiva e audita dentro da transação", async () => {
    expect((await request("POST", "", input, ["ADMIN"])).status).toBe(201);
    expect(mocks.query.mock.calls[0][1]).toBe(`veiculo:${veiculoId}`);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        ...input,
        dataManutencao: new Date("2026-10-30"),
        status: "ABERTA",
        dataConclusao: null,
      },
    });
    expect(mocks.vehicleUpdate).toHaveBeenCalledWith({
      where: { id: veiculoId },
      data: { status: "MANUTENCAO" },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acao: "CRIAR", usuarioId: id }) }),
    );
  });
  it("registra preventiva concluída sem alterar status do veículo", async () => {
    expect((await request("POST", "", { ...input, tipo: "PREVENTIVA" })).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "CONCLUIDA", dataConclusao: new Date("2026-10-30") }),
    });
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });
  it.each([null, { ativo: false, status: "DISPONIVEL" }, { ativo: true, status: "EM_VIAGEM" }])(
    "impede corretiva em veículo indisponível %s",
    async (veiculo) => {
      mocks.vehicle.mockResolvedValue(veiculo);
      expect((await request("POST", "", input)).status).toBe(422);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("rejeita fornecedor inativo", async () => {
    mocks.supplier.mockResolvedValue({ ativo: false });
    expect((await request("POST", "", { ...input, fornecedorId: id })).status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("libera somente veículo ativo em manutenção após a última conclusão", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.body.statusVeiculo).toBe("DISPONIVEL");
    expect(mocks.release).toHaveBeenCalledWith({
      where: { id: veiculoId, ativo: true, status: "MANUTENCAO" },
      data: { status: "DISPONIVEL" },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id, status: "ABERTA" },
      data: { status: "CONCLUIDA", dataConclusao: expect.any(Date) },
    });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it("mantém manutenção quando há outras abertas", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.vehicleResult.mockResolvedValue({ status: "MANUTENCAO" });
    expect((await request()).body.statusVeiculo).toBe("MANUTENCAO");
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it("retorna status real quando a liberação condicional não altera o veículo", async () => {
    mocks.release.mockResolvedValue({ count: 0 });
    mocks.vehicleResult.mockResolvedValue({ status: "EM_VIAGEM" });
    expect((await request()).body.statusVeiculo).toBe("EM_VIAGEM");
  });
  it("rejeita segunda conclusão sem liberar nem auditar", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await request()).status).toBe(422);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("retorna 404 para manutenção inexistente", async () => {
    mocks.lookup.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("valida UUID antes de acessar banco", async () => {
    expect((await request("PATCH", "/invalido/concluir")).status).toBe(400);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("não conclui a transação quando a auditoria falha", async () => {
    const falha = new Error("falha de auditoria");
    mocks.audit.mockRejectedValue(falha);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const resposta = await request();
      expect(resposta.status).toBe(500);
      expect(resposta.body.message).toBe("Erro interno do servidor.");
      await expect(mocks.transaction.mock.results[0]?.value).rejects.toBe(falha);
    } finally {
      log.mockRestore();
    }
  });
  it("retorna conflito recuperável para disputa transacional", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflito", {
        code: "P2034",
        clientVersion: "6.19.3",
      }),
    );
    expect((await request()).status).toBe(409);
  });
});
