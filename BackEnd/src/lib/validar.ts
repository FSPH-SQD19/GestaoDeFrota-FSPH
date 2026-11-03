import type { z } from "zod";
import { HttpError } from "./http_error";

export function validar<T extends z.ZodType>(schema: T, dados: unknown): z.infer<T> {
  const resultado = schema.safeParse(dados, {
    error: (issue) => {
      if (issue.code === "too_big") {
        return issue.origin === "string"
          ? `Use no máximo ${issue.maximum} caracteres neste campo.`
          : issue.inclusive === false
            ? `Informe um valor menor que ${issue.maximum}.`
            : `Informe um valor de até ${issue.maximum}.`;
      }
      if (issue.code === "too_small") {
        return issue.origin === "string"
          ? `Preencha este campo com pelo menos ${issue.minimum} caracteres.`
          : issue.inclusive === false
            ? `Informe um valor maior que ${issue.minimum}.`
            : `Informe um valor a partir de ${issue.minimum}.`;
      }
      return "Confira os dados informados neste campo e tente novamente.";
    },
  });
  if (resultado.success) return resultado.data;
  throw new HttpError(
    400,
    "Revise os campos indicados e tente novamente.",
    resultado.error.issues.map((issue) => ({
      campo: issue.path.join("."),
      mensagem: issue.message,
    })),
  );
}
