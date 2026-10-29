import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  registrarAuditoria: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    motorista: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
    usuario: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

import { cadastrarMotorista } from "../../../src/service/motorista_s";

const usuarioId = "00000000-0000-4000-8000-000000000001";
const usuarioResponsavelId = "550e8400-e29b-41d4-a716-446655440000";

const entrada = {
  cpf: "123.456.789-09",
  numeroCnh: "12345678901",
  categoriaCnh: "b",
  validadeCnh: "2026-10-20",
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));

  mocks.findFirst.mockResolvedValue(null);
  mocks.findUnique.mockResolvedValue({ id: usuarioId });
  mocks.create.mockResolvedValue({ id: "motorista-sintetico" });
  mocks.registrarAuditoria.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

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

      await expect(
        cadastrarMotorista(
          { ...entrada, validadeCnh },
          usuarioResponsavelId,
        ),
      ).resolves.toEqual({
        id: "motorista-sintetico",
      });

      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validadeCnh: new Date(`${validadeCnh}T00:00:00.000Z`),
          }),
        }),
      );

      expect(mocks.registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: usuarioResponsavelId,
          acao: "CRIAR",
          tabelaAfetada: "motoristas",
          registroId: "motorista-sintetico",
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

      await expect(
        cadastrarMotorista(
          { ...entrada, validadeCnh },
          usuarioResponsavelId,
        ),
      ).rejects.toThrow("A CNH está vencida.");

      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.registrarAuditoria).not.toHaveBeenCalled();
    },
  );

  it("aceita validade futura", async () => {
    await cadastrarMotorista(
      { ...entrada, validadeCnh: "2027-01-01" },
      usuarioResponsavelId,
    );

    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.registrarAuditoria).toHaveBeenCalledOnce();
  });

  it.each(["2026-02-30", "2026-13-01", "20/10/2026"])(
    "recusa data inválida %s antes da consulta",
    async (validadeCnh) => {
      await expect(
        cadastrarMotorista(
          { ...entrada, validadeCnh },
          usuarioResponsavelId,
        ),
      ).rejects.toThrow(/validade/i);

      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.registrarAuditoria).not.toHaveBeenCalled();
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
  ])(
    "recusa UUID inválido %j antes de acessar o Prisma",
    async (usuarioIdInvalido) => {
      await expect(
        cadastrarMotorista(
          { ...entrada, usuarioId: usuarioIdInvalido },
          usuarioResponsavelId,
        ),
      ).rejects.toThrow("usuarioId inválido.");

      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.registrarAuditoria).not.toHaveBeenCalled();
    },
  );

  it("consulta e vincula usuário com UUID válido", async () => {
    await cadastrarMotorista(
      { ...entrada, usuarioId },
      usuarioResponsavelId,
    );

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: usuarioId },
      select: { id: true },
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId,
          cpf: "12345678909",
          categoriaCnh: "B",
        }),
      }),
    );

    expect(mocks.registrarAuditoria).toHaveBeenCalledOnce();
  });

  it("permite omitir o vínculo com usuário", async () => {
    await cadastrarMotorista(entrada, usuarioResponsavelId);

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.registrarAuditoria).toHaveBeenCalledOnce();
  });
});