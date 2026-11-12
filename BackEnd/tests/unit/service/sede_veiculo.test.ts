import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  sede: vi.fn(),
  audit: vi.fn(),
  lock: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    veiculo: { findUnique: m.findUnique, findMany: m.findMany, count: m.count },
    $transaction: m.transaction,
  },
}));
vi.mock("../../../src/service/auditoria_s", () => ({ registrarAuditoria: vi.fn() }));
import {
  atualizarVeiculo,
  listarVeiculos,
  listarVeiculosSchema,
} from "../../../src/service/veiculo_s";
const id = "00000000-0000-4000-8000-000000000001";
const sedeId = "00000000-0000-4000-8000-000000000002";
const atual = {
  id,
  placa: "ABC1234",
  tipoFrota: "SVO",
  propriedade: "PROPRIO",
  status: "DISPONIVEL",
  fornecedorId: null,
  sedeId: null,
  sede: null,
  foraDeSede: false,
  sedeAtualizadaEm: null,
  odometroAtual: new Prisma.Decimal(0),
  kmProximaRevisao: null,
};
describe("sede do veículo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findUnique.mockResolvedValue(atual);
    m.sede.mockResolvedValue({ id: sedeId, nome: "Sede central", ativo: true });
    m.transaction.mockImplementation(async (fn) =>
      fn({
        $queryRaw: m.lock,
        veiculo: { findUniqueOrThrow: m.findUnique, update: m.update, create: m.create },
        sede: { findUnique: m.sede },
        auditoriaSistema: { create: m.audit },
      }),
    );
    m.update.mockImplementation(async ({ data }) => ({
      ...atual,
      ...data,
      sede: data.sedeId ? { nome: "Sede central" } : null,
    }));
  });
  it("grava sede, horário e responsável atomicamente", async () => {
    const r = await atualizarVeiculo(id, { sedeId }, id);
    expect(r.sedeId).toBe(sedeId);
    expect(r.sedeAtualizadaEm).toBeInstanceOf(Date);
    expect(m.lock).toHaveBeenCalledOnce();
    expect(m.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: id,
        registroId: id,
        acao: "ALTERAR_SEDE",
        dadosNovos: expect.objectContaining({
          sedeAnterior: { sedeId: null, nome: null, foraDeSede: false },
          novaSede: { sedeId, nome: "Sede central", foraDeSede: false },
        }),
      }),
    });
  });

  it("remove a sede anterior ao registrar fora de sede", async () => {
    m.findUnique.mockResolvedValue({ ...atual, sedeId, sede: { nome: "Sede central" } });
    const resposta = await atualizarVeiculo(id, { foraDeSede: true }, id);
    expect(resposta).toMatchObject({ sedeId: null, foraDeSede: true });
    expect(m.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dadosNovos: expect.objectContaining({
          sedeAnterior: { sedeId, nome: "Sede central", foraDeSede: false },
          novaSede: { sedeId: null, nome: null, foraDeSede: true },
        }),
      }),
    });
  });
  it("propaga falha de auditoria para desfazer a transacao", async () => {
    m.audit.mockRejectedValueOnce(new Error("auditoria indisponivel"));
    await expect(atualizarVeiculo(id, { sedeId }, id)).rejects.toThrow("auditoria indisponivel");
  });
  it("rejeita sede inativa para uma nova atribuição", async () => {
    m.sede.mockResolvedValue({ ativo: false });
    await expect(atualizarVeiculo(id, { sedeId }, id)).rejects.toThrow("sede ativa");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("rejeita sede e fora de sede simultaneamente", async () => {
    await expect(atualizarVeiculo(id, { sedeId, foraDeSede: true }, id)).rejects.toThrow(
      "fora de sede",
    );
  });
  it("não altera horário ou duplica histórico ao repetir a localização", async () => {
    await atualizarVeiculo(id, { sedeId: null, foraDeSede: false }, id);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.update.mock.calls[0][0].data).not.toHaveProperty("sedeAtualizadaEm");
  });
  it.each([
    ["SEM_SEDE", { sedeId: null, foraDeSede: false }],
    ["FORA_DE_SEDE", { foraDeSede: true }],
    [sedeId, { sedeId }],
  ])("filtra %s no banco antes da paginação", async (sede, where) => {
    m.findMany.mockResolvedValue([]);
    m.count.mockResolvedValue(0);
    await listarVeiculos(listarVeiculosSchema.parse({ sede }));
    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(where) }),
    );
  });
});
