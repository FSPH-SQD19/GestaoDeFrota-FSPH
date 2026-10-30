import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/service/auth_s", () => ({ login: vi.fn() }));

import { loginController } from "../../../src/controller/auth_c";
import { login } from "../../../src/service/auth_s";

const result = {
  token: "token-sintetico",
  usuario: { id: "usuario-teste", nome: "Teste", email: "teste@example.test", perfis: ["GESTOR"] },
};

async function execute(body: unknown) {
  const req = { body } as Request;
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  await loginController(req, res);
  return { status, json };
}

describe("login controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(login).mockResolvedValue(result);
  });

  it.each([
    { case: "corpo ausente", body: undefined },
    { case: "corpo nulo", body: null },
    { case: "campos ausentes", body: {} },
    { case: "email numerico", body: { email: 123, senha: "teste" } },
    { case: "email em branco", body: { email: "   ", senha: "teste" } },
    { case: "senha ausente", body: { email: "teste@example.test" } },
    { case: "senha vazia", body: { email: "teste@example.test", senha: "" } },
  ])("retorna 400 para $case", async ({ body }) => {
    const response = await execute(body);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "email e senha são obrigatórios" });
    expect(login).not.toHaveBeenCalled();
  });

  it("normaliza o email e envia apenas uma resposta de sucesso", async () => {
    const response = await execute({ email: "  teste@example.test  ", senha: "teste" });

    expect(login).toHaveBeenCalledWith({ email: "teste@example.test", senha: "teste" });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledExactlyOnceWith(result);
  });

  it("retorna 401 quando o service rejeita as credenciais", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(login).mockRejectedValue(new Error("Credenciais inválidas"));
    const response = await execute({ email: "teste@example.test", senha: "teste" });

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Credenciais inválidas" });
  });

  it("retorna erro generico sem expor detalhes internos", async () => {
    vi.mocked(login).mockRejectedValue(new Error("Detalhe privado da infraestrutura"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await execute({ email: "teste@example.test", senha: "teste" });

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ mensagem: "Erro interno ao realizar login." });
  });
});
