import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    perfil: { findUnique: vi.fn() },
    usuario: { create: vi.fn() },
    motorista: { create: vi.fn() },
  };

  return {
    findFirst: vi.fn(),
    hashPassword: vi.fn(),
    transactionClient,
    transaction: vi.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
    ),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    motorista: { findFirst: mocks.findFirst },
  },
}));
vi.mock("../../../src/service/password_s", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: vi.fn().mockResolvedValue({}),
}));

import { registrarAuditoria } from "../../../src/service/auditoria_s";
import { cadastrarMotorista as cadastrar } from "../../../src/service/motorista_s";

const cadastrarMotorista = (dados: Parameters<typeof cadastrar>[0]) =>
  cadastrar(dados, "administrador-teste");

const entrada = {
  nome: "  Motorista de Teste  ",
  email: "  MOTORISTA@example.com ",
  senha: "senha-segura-de-teste",
  telefone: "(79) 99999-1234",
  cpf: "123.456.789-09",
  numeroCnh: "12345678901",
  categoriaCnh: "b",
  validadeCnh: "2026-10-20",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
  mocks.findFirst.mockResolvedValue(null);
  mocks.hashPassword.mockResolvedValue("hash-seguro");
  mocks.transactionClient.perfil.findUnique.mockResolvedValue({ id: "perfil-motorista" });
  mocks.transactionClient.usuario.create.mockResolvedValue({ id: "usuario-sintetico" });
  mocks.transactionClient.motorista.create.mockResolvedValue({ id: "motorista-sintetico" });
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.transactionClient));
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
      expect(mocks.transactionClient.motorista.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validadeCnh: new Date(`${validadeCnh}T00:00:00.000Z`),
          }),
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
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it("aceita validade futura", async () => {
    await cadastrarMotorista({ ...entrada, validadeCnh: "2027-01-01" });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it.each(["2026-02-30", "2026-13-01", "20/10/2026"])(
    "recusa data inválida %s antes da consulta",
    async (validadeCnh) => {
      await expect(cadastrarMotorista({ ...entrada, validadeCnh })).rejects.toThrow(/validade/);
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );
});

describe("cadastro conjunto do motorista e sua conta", () => {
  it("aceita senha com exatamente seis caracteres", async () => {
    await cadastrarMotorista({ ...entrada, senha: "abc123" });
    expect(mocks.hashPassword).toHaveBeenCalledWith("abc123");
  });
  it.each([
    [{ ...entrada, nome: "  " }, "Nome inválido."],
    [{ ...entrada, email: "email-inválido" }, "E-mail inválido."],
    [{ ...entrada, senha: "12345" }, "A senha deve possuir pelo menos 6 caracteres."],
    [{ ...entrada, telefone: "9999" }, "Telefone deve conter DDD e 8 ou 9 dígitos."],
  ])("valida os dados de acesso antes de consultar o banco", async (dados, mensagem) => {
    await expect(cadastrarMotorista(dados)).rejects.toThrow(mensagem);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cria a conta com perfil MOTORISTA e o motorista na mesma transação", async () => {
    await cadastrarMotorista(entrada);

    expect(mocks.hashPassword).toHaveBeenCalledWith("senha-segura-de-teste");
    expect(mocks.transactionClient.perfil.findUnique).toHaveBeenCalledWith({
      where: { nome: "MOTORISTA" },
      select: { id: true },
    });
    expect(mocks.transactionClient.usuario.create).toHaveBeenCalledWith({
      data: {
        nome: "Motorista de Teste",
        email: "motorista@example.com",
        senhaHash: "hash-seguro",
        ativo: true,
        perfis: { create: { perfilId: "perfil-motorista" } },
      },
      select: { id: true },
    });
    expect(mocks.transactionClient.motorista.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioId: "usuario-sintetico",
          telefone: "(79) 99999-1234",
          cpf: "12345678909",
          categoriaCnh: "B",
        }),
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      }),
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("não cria conta nem motorista se o perfil MOTORISTA não existir", async () => {
    mocks.transactionClient.perfil.findUnique.mockResolvedValue(null);

    await expect(cadastrarMotorista(entrada)).rejects.toThrow("Perfil MOTORISTA não encontrado.");
    expect(mocks.transactionClient.usuario.create).not.toHaveBeenCalled();
    expect(mocks.transactionClient.motorista.create).not.toHaveBeenCalled();
  });
});

describe("auditoria e falhas de criação", () => {
  it("registra a criação sem credenciais na auditoria", async () => {
    await cadastrarMotorista(entrada);
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: "administrador-teste",
        acao: "CRIAR",
        tabelaAfetada: "motoristas",
        registroId: "motorista-sintetico",
        dadosNovos: { id: "motorista-sintetico" },
      }),
    );
  });
  it("propaga falha da transação sem anunciar nem auditar sucesso", async () => {
    mocks.transactionClient.motorista.create.mockRejectedValueOnce(new Error("Falha no banco"));
    await expect(cadastrarMotorista(entrada)).rejects.toThrow("Falha no banco");
    expect(registrarAuditoria).not.toHaveBeenCalled();
  });
  it("uma falha de auditoria não transforma cadastro concluído em erro", async () => {
    vi.mocked(registrarAuditoria).mockRejectedValueOnce(new Error("Falha de auditoria"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(cadastrarMotorista(entrada)).resolves.toEqual({ id: "motorista-sintetico" });
  });
});
