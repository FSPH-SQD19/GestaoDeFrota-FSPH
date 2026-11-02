import { z } from "zod";

export const veiculoSchema = z.object({
  placa: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, "Placa inválida. Use ABC1234 ou ABC1D23."),
    ),
  modelo: z
    .string()
    .trim()
    .min(2, "Modelo deve ter ao menos 2 caracteres.")
    .max(100, "Modelo deve ter no máximo 100 caracteres."),
  tipoFrota: z.enum(["ADMINISTRATIVA", "SVO"]),
  capacidadeMaxima: z.coerce
    .number()
    .int("Capacidade deve ser inteira.")
    .min(1, "Capacidade deve ser maior que zero.")
    .max(50, "Capacidade máxima excedida."),
  ano: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .pipe(
      z
        .number()
        .int("Ano deve ser inteiro.")
        .min(1950, "Ano inválido.")
        .refine((v) => v <= new Date().getFullYear() + 1, "Ano inválido.")
        .optional(),
    ),
  combustivel: z
    .string()
    .trim()
    .max(30, "Combustível deve ter no máximo 30 caracteres.")
    .transform((v) => v || undefined),
});
