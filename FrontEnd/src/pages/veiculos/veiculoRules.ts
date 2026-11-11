import { z } from "zod";

export const TIPOS_DOCUMENTO_VEICULO = ["CRLV", "IPVA", "SEGURO", "VISTORIA"] as const;
export type TipoDocumentoVeiculo = (typeof TIPOS_DOCUMENTO_VEICULO)[number];

export const kmRevisaoFormularioSchema = z
  .string()
  .trim()
  .transform((valor) => (valor === "" ? null : Number(valor)))
  .pipe(
    z
      .number({ error: "Informe a quilometragem da próxima revisão." })
      .positive("A quilometragem da revisão deve ser maior que zero.")
      .max(99999999.99, "Quilometragem da revisão inválida.")
      .refine((valor) => Math.round(valor * 100) / 100 === valor, "Use no máximo 2 casas decimais.")
      .nullable(),
  );

export const veiculoSchema = z
  .object({
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
    tipoFrota: z.enum(["ADMINISTRATIVA", "SVO"], {
      error: "Selecione a frota administrativa ou a frota do SVO.",
    }),
    propriedade: z.enum(["PROPRIO", "LOCADO"], {
      error: "Informe se o veículo é próprio ou locado.",
    }),
    fornecedorId: z.string().trim().optional(),
    capacidadeMaxima: z.coerce
      .number({ error: "Informe a quantidade de passageiros que o veículo comporta." })
      .int("Capacidade deve ser inteira.")
      .min(1, "Capacidade deve ser maior que zero.")
      .max(50, "Capacidade máxima excedida."),
    ano: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : Number(v)))
      .pipe(
        z
          .number({ error: "Informe um ano válido para o veículo." })
          .int("Ano deve ser inteiro.")
          .min(1950, "Ano inválido.")
          .refine((v) => v <= new Date().getFullYear() + 1, "Ano inválido.")
          .optional(),
      ),
    kmProximaRevisao: kmRevisaoFormularioSchema.optional(),
    combustivel: z
      .string()
      .trim()
      .max(30, "Combustível deve ter no máximo 30 caracteres.")
      .transform((v) => v || undefined),
  })
  .superRefine((dados, ctx) => {
    if (dados.propriedade !== "LOCADO") return;
    if (!dados.fornecedorId || !z.uuid().safeParse(dados.fornecedorId).success) {
      ctx.addIssue({
        code: "custom",
        path: ["fornecedorId"],
        message: "Selecione a locadora do veículo.",
      });
    }
  })
  .transform(({ fornecedorId, kmProximaRevisao, ...rest }) => ({
    ...rest,
    ...(rest.propriedade === "LOCADO" ? { fornecedorId } : {}),
    ...(kmProximaRevisao == null ? {} : { kmProximaRevisao }),
  }));

export const documentoVeiculoSchema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_VEICULO, {
    error: "Selecione o documento: CRLV, IPVA, seguro ou vistoria.",
  }),
  dataVencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de vencimento.")
    .refine(
      (data) => data >= "2000-01-01" && data <= "2100-12-31",
      "Data de vencimento fora do intervalo permitido.",
    ),
});
