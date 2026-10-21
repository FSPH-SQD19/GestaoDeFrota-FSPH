import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: { auditoriaSistema: { create: mocks.create } },
}));

import { registrarAuditoria } from "../../../src/service/auditoria_s";

describe("auditoria service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("registra campos opcionais como nulos quando nao informados", async () => {
    const input = { acao: "CRIAR", tabelaAfetada: "veiculos", dadosNovos: { placa: "ABC1D23" } };
    const saved = { id: "auditoria-teste" };
    mocks.create.mockResolvedValue(saved);

    await expect(registrarAuditoria(input)).resolves.toBe(saved);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { ...input, usuarioId: null, registroId: null },
    });
  });

  it("preserva os identificadores e dados informados", async () => {
    const input = {
      usuarioId: "usuario-teste",
      registroId: "veiculo-teste",
      acao: "ATUALIZAR",
      tabelaAfetada: "veiculos",
      dadosNovos: { ativo: false },
    };
    await registrarAuditoria(input);

    expect(mocks.create).toHaveBeenCalledWith({ data: input });
  });
});
