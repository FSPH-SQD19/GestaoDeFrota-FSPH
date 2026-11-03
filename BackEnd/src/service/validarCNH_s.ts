import { HttpError } from "../lib/http_error";

export function validarDataValidadeCnh(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(400, "Informe uma data válida para a validade da CNH.");
  }

  const validadeCnh = new Date(`${valor}T00:00:00.000Z`);

  if (Number.isNaN(validadeCnh.getTime()) || validadeCnh.toISOString().slice(0, 10) !== valor) {
    throw new HttpError(400, "Data de validade da CNH inválida.");
  }

  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  if (valor < hoje) {
    throw new HttpError(400, "A CNH está vencida.");
  }

  return validadeCnh;
}
