import { HttpError } from "../../../src/lib/http_error";
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "test", expiresIn: 28800 }),
}));
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
  const res = { status, json, setHeader: vi.fn(), cookie: vi.fn() } as unknown as Response;
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
    await expect(execute(body)).rejects.toMatchObject({
      statusCode: 400,
      message: "Informe o e-mail e a senha.",
    });
    expect(login).not.toHaveBeenCalled();
  });

  it("normaliza o email e envia apenas uma resposta de sucesso", async () => {
    const response = await execute({ email: "  teste@example.test  ", senha: "teste" });

    expect(login).toHaveBeenCalledWith({ email: "teste@example.test", senha: "teste" });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledExactlyOnceWith({ usuario: result.usuario });
  });

  it("encaminha a rejeição de credenciais ao middleware", async () => {
    const error = new HttpError(
      401,
      "E-mail ou senha incorretos. Confira os dados e tente novamente.",
    );
    vi.mocked(login).mockRejectedValue(error);
    await expect(execute({ email: "teste@example.test", senha: "teste" })).rejects.toBe(error);
  });

  it("encaminha erros inesperados sem traduzi-los no controller", async () => {
    const error = new Error("Detalhe privado da infraestrutura");
    vi.mocked(login).mockRejectedValue(error);
    await expect(execute({ email: "teste@example.test", senha: "teste" })).rejects.toBe(error);
  });
});
