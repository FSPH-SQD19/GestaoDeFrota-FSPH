import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() }));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    motorista: { findFirst: mocks.findFirst, create: mocks.create },
    usuario: { findUnique: mocks.findUnique },
  },
}));

import { cadastrarMotorista } from "../../../src/service/motorista_s";

const usuarioId = "00000000-0000-4000-8000-000000000001";
const entrada = {
  cpf: "123.456.789-09",
  numeroCnh: "12345678901",
  categoriaCnh: "b",
  validadeCnh: "2026-10-20",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
  mocks.findFirst.mockResolvedValue(null);
  mocks.findUnique.mockResolvedValue({ id: usuarioId });
  mocks.create.mockResolvedValue({ id: "motorista-sintetico" });
});
afterEach(() => vi.useRealTimers());

describe("dia de validade da CNH em America/Sao_Paulo", () => {
  it.each([
    ["2026-10-20T23:59:59Z", "2026-10-20"],
    ["2026-10-21T00:00:00Z", "2026-10-20"],
    ["2026-10-21T02:59:59.999Z", "2026-10-20"],
    ["2027-01-01T02:59:59.999Z", "2026-12-31"],
    ["2026-11-01T02:59:59.999Z", "2026-10-31"],
  ])(
    "aceita CNH válida até o fim do dia: instante %s, validade %s",
    async (instante, validadeCnh) => {
      vi.setSystemTime(new Date(instante));
      await expect(cadastrarMotorista({ ...entrada, validadeCnh })).resolves.toEqual({
        id: "motorista-sintetico",
      });
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ validadeCnh: new Date(`${validadeCnh}T00:00:00.000Z`) }),
        }),
      );
    },
  );

  it.each([
    ["2026-10-21T03:00:00Z", "2026-10-20"],
    ["2027-01-01T03:00:00Z", "2026-12-31"],
    ["2026-11-01T03:00:00Z", "2026-10-31"],
  ])(
    "recusa a partir da meia-noite local: instante %s, validade %s",
    async (instante, validadeCnh) => {
      vi.setSystemTime(new Date(instante));
      await expect(cadastrarMotorista({ ...entrada, validadeCnh })).rejects.toThrow(
        "A CNH está vencida.",
      );
      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("aceita validade futura", async () => {
    await cadastrarMotorista({ ...entrada, validadeCnh: "2027-01-01" });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it.each(["2026-02-30", "2026-13-01", "20/10/2026"])(
    "recusa data inválida %s antes da consulta",
    async (validadeCnh) => {
      await expect(cadastrarMotorista({ ...entrada, validadeCnh })).rejects.toThrow(/validade/);
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );
});

describe("validação de usuarioId no serviço", () => {
  it.each([
    "abc",
    "",
    "   ",
    "00000000000040008000000000000001",
    "00000000-0000-4000-8000-00000000000z",
  ])("recusa UUID inválido %j antes de acessar o Prisma", async (usuarioIdInvalido) => {
    await expect(cadastrarMotorista({ ...entrada, usuarioId: usuarioIdInvalido })).rejects.toThrow(
      "usuarioId inválido.",
    );
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("consulta e vincula usuário com UUID válido", async () => {
    await cadastrarMotorista({ ...entrada, usuarioId });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: usuarioId },
      select: { id: true },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuarioId, cpf: "12345678909", categoriaCnh: "B" }),
      }),
    );
  });

  it("permite omitir o vínculo com usuário", async () => {
    await cadastrarMotorista(entrada);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
