import type { ErrorRequestHandler } from "express";
import { HttpError, type ErroDetalhe } from "../lib/http_error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  let statusCode = 500;
  let message = "O sistema não conseguiu concluir a operação. Tente novamente em alguns instantes.";
  let errors: ErroDetalhe[] = [];

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error?.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Não foi possível ler os dados enviados. Revise os dados e tente novamente.";
  } else if (error?.type === "entity.too.large") {
    statusCode = 413;
    message =
      "Os dados enviados são muito grandes. Reduza o tamanho dos arquivos e tente novamente.";
  }

  if (statusCode >= 500) console.error(error);
  return res.status(statusCode).json({ statusCode, message, errors });
};
