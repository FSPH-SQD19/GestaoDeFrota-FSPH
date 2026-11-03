import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../src/lib/http_error";
import { errorHandler } from "../../../src/middleware/error_m";

function responder(error: unknown, headersSent = false) {
  const res = { headersSent, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  errorHandler(error, {} as Request, res as unknown as Response, next);
  return { res, next };
}

describe("respostas centralizadas de erro", () => {
  it("preserva status, mensagem e detalhes de erros de negócio sem registrar falha interna", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const errors = [{ campo: "cnpj", mensagem: "CNPJ já cadastrado." }];
    const { res } = responder(new HttpError(409, "Conflito no cadastro.", errors));

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      statusCode: 409,
      message: "Conflito no cadastro.",
      errors,
    });
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    new Error("Senha do banco: segredo"),
    { statusCode: 400, message: "Falha privada sem HttpError" },
    undefined,
  ])("registra falha inesperada uma vez e oculta detalhes: %j", (error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { res } = responder(error);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      statusCode: 500,
      message: "O sistema não conseguiu concluir a operação. Tente novamente em alguns instantes.",
      errors: [],
    });
    expect(log).toHaveBeenCalledExactlyOnceWith(error);
  });

  it.each([
    [
      "entity.parse.failed",
      400,
      "Não foi possível ler os dados enviados. Revise os dados e tente novamente.",
    ],
    [
      "entity.too.large",
      413,
      "Os dados enviados são muito grandes. Reduza o tamanho dos arquivos e tente novamente.",
    ],
  ])("padroniza erros do parser %s", (type, statusCode, message) => {
    const { res } = responder({ type });
    expect(res.status).toHaveBeenCalledWith(statusCode);
    expect(res.json).toHaveBeenCalledWith({ statusCode, message, errors: [] });
  });

  it("encaminha falhas após o envio de cabeçalhos sem tentar responder novamente", () => {
    const error = new Error("Conexão encerrada");
    const { res, next } = responder(error, true);
    expect(next).toHaveBeenCalledExactlyOnceWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
