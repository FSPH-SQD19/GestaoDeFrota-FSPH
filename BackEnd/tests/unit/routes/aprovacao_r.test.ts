import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  solicitacao: vi.fn(),
  veiculo: vi.fn(),
  motorista: vi.fn(),
  conflito: vi.fn(),
  update: vi.fn(),
  resultado: vi.fn(),
  auditoria: vi.fn(),
  transaction: vi.fn(),
}));
const tx = {
  $queryRaw: mocks.query,
  solicitacaoViagem: {
    findUnique: mocks.solicitacao,
    findFirst: mocks.conflito,
    updateMany: mocks.update,
    findUniqueOrThrow: mocks.resultado,
  },
  veiculo: { findUnique: mocks.veiculo },
  motorista: { findUnique: mocks.motorista },
  auditoriaSistema: { create: mocks.auditoria },
};
vi.mock("../../../src/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "aprovacao-teste", expiresIn: 28800 }),
}));
import { app } from "../../../src/app";
const id = "00000000-0000-4000-8000-000000000001",
  veiculoId = "00000000-0000-4000-8000-000000000002",
  motoristaId = "00000000-0000-4000-8000-000000000003";
const solicitacao = {
  id,
  protocolo: "SV-TESTE",
  status: "PENDENTE",
  quantidadePassageiros: 3,
  dataHoraPretendida: new Date("2026-11-10T08:00:00-03:00"),
  dataHoraRetornoPrevista: new Date("2026-11-10T18:00:00-03:00"),
};
let server: Server, url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  mocks.query.mockResolvedValue([{ locked: 1 }]);
  mocks.solicitacao.mockResolvedValue(solicitacao);
  mocks.veiculo.mockResolvedValue({
    id: veiculoId,
    ativo: true,
    tipoFrota: "ADMINISTRATIVA",
    status: "DISPONIVEL",
    capacidadeMaxima: 4,
  });
  mocks.motorista.mockResolvedValue({
    id: motoristaId,
    ativo: true,
    status: "DISPONIVEL",
    validadeCnh: new Date("2026-11-10T00:00:00Z"),
  });
  mocks.conflito.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.resultado.mockResolvedValue({ ...solicitacao, status: "APROVADA" });
  mocks.auditoria.mockResolvedValue({});
  mocks.transaction.mockImplementation((fn) => fn(tx));
});
async function decidir(
  acao = "aprovar",
  body: unknown = { veiculoId, motoristaId },
  perfis: string[] | null = ["GESTOR"],
  prefix = "/api/v1/solicitacoes",
  registroId = id,
) {
  const response = await fetch(`${url}${prefix}/${registroId}/${acao}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(perfis
        ? {
            authorization: `Bearer ${signTestToken({ perfis }, "aprovacao-teste", { subject: id })}`,
          }
        : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
describe.each(["/api/v1/solicitacoes", "/solicitacoes"])("decisões em %s", (prefix) => {
  it("aprova com trava, atualização condicional e auditoria", async () => {
    const response = await decidir("aprovar", { veiculoId, motoristaId }, ["ADMIN"], prefix);
    expect(response.status).toBe(200);
    expect(response.body.dados.status).toBe("APROVADA");
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[0][0].join("")).toContain(
      "SELECT 1 AS locked FROM pg_advisory_xact_lock",
    );
    expect(mocks.query.mock.calls[0][1]).toBe(`motorista:${motoristaId}`);
    expect(mocks.query.mock.calls[1][1]).toBe(`veiculo:${veiculoId}`);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, status: "PENDENTE" },
        data: expect.objectContaining({
          status: "APROVADA",
          veiculoAlocadoId: veiculoId,
          motoristaAlocadoId: motoristaId,
        }),
      }),
    );
    expect(mocks.auditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuarioId: id, acao: "APROVAR" }),
      }),
    );
  });
  it("recusa com motivo normalizado e auditoria", async () => {
    mocks.resultado.mockResolvedValue({ ...solicitacao, status: "RECUSADA" });
    expect(
      (await decidir("recusar", { motivoRecusa: " Sem disponibilidade " }, ["GESTOR"], prefix))
        .status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id, status: "PENDENTE" },
      data: { status: "RECUSADA", motivoRecusa: "Sem disponibilidade" },
    });
    expect(mocks.auditoria).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acao: "RECUSAR" }) }),
    );
  });
  it.each([null, ["SOLICITANTE"], ["MOTORISTA"], ["SVO"]])(
    "protege decisões para perfil %j",
    async (perfis) => {
      expect((await decidir("aprovar", { veiculoId, motoristaId }, perfis, prefix)).status).toBe(
        perfis ? 403 : 401,
      );
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
});
describe("regras de aprovação", () => {
  it.each([{ veiculoId: "inválido", motoristaId }, {}])(
    "rejeita dados inválidos: %j",
    async (body) => {
      expect((await decidir("aprovar", body)).status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("valida o id antes da transação", async () => {
    expect(
      (await decidir("aprovar", { veiculoId, motoristaId }, ["GESTOR"], undefined, "inválido"))
        .status,
    ).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("retorna 404 para solicitação inexistente", async () => {
    mocks.solicitacao.mockResolvedValue(null);
    expect((await decidir()).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("não processa novamente uma decisão", async () => {
    mocks.solicitacao.mockResolvedValue({ ...solicitacao, status: "APROVADA" });
    expect((await decidir()).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("exige intervalo completo", async () => {
    mocks.solicitacao.mockResolvedValue({ ...solicitacao, dataHoraRetornoPrevista: null });
    expect((await decidir()).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("confere capacidade no servidor", async () => {
    mocks.veiculo.mockResolvedValue({
      ativo: true,
      tipoFrota: "ADMINISTRATIVA",
      status: "DISPONIVEL",
      capacidadeMaxima: 2,
    });
    expect((await decidir()).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ativo: false },
    { ativo: true, tipoFrota: "SVO" },
    { ativo: true, tipoFrota: "ADMINISTRATIVA", status: "MANUTENCAO" },
  ])("recusa veículo indisponível: %j", async (veiculo) => {
    mocks.veiculo.mockResolvedValue(veiculo);
    expect((await decidir()).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["EM_VIAGEM", "EM_ROTA", "INDISPONIVEL"])("recusa motorista em %s", async (status) => {
    mocks.motorista.mockResolvedValue({ ativo: true, status });
    expect((await decidir()).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("confere a CNH até a data local do retorno", async () => {
    mocks.motorista.mockResolvedValue({
      ativo: true,
      status: "DISPONIVEL",
      validadeCnh: new Date("2026-11-09T00:00:00Z"),
    });
    expect((await decidir()).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("retorna conflito de horário antes de alterar o pedido", async () => {
    mocks.conflito.mockResolvedValue({ id: "outro" });
    expect((await decidir()).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.conflito).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataHoraPretendida: { lt: solicitacao.dataHoraRetornoPrevista },
          dataHoraRetornoPrevista: { gt: solicitacao.dataHoraPretendida },
          OR: [{ veiculoAlocadoId: veiculoId }, { motoristaAlocadoId: motoristaId }],
        }),
      }),
    );
  });
  it("trata disputa na atualização sem auditar sucesso", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await decidir()).status).toBe(409);
    expect(mocks.auditoria).not.toHaveBeenCalled();
  });
  it("traduz erro de concorrência do Prisma", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Conflito", { code: "P2034", clientVersion: "6" }),
    );
    expect((await decidir()).status).toBe(409);
  });
});
describe("regras de recusa", () => {
  it.each(["", " ", "a".repeat(2001)])("valida o motivo", async (motivoRecusa) => {
    expect((await decidir("recusar", { motivoRecusa })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([true, false])("distingue decisão processada de ausência: %s", async (existe) => {
    mocks.update.mockResolvedValue({ count: 0 });
    mocks.solicitacao.mockResolvedValue(existe ? { id } : null);
    expect((await decidir("recusar", { motivoRecusa: "Sem recursos" })).status).toBe(
      existe ? 409 : 404,
    );
    expect(mocks.auditoria).not.toHaveBeenCalled();
  });
});
