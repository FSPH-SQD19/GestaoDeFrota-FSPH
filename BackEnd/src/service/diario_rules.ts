import { z } from "zod";
export const coordenadasSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const itensChecklist = [
  "pneus",
  "iluminacao",
  "freios",
  "fluidos",
  "equipamentos",
  "limpeza",
] as const;
const item = z
  .object({
    estado: z.enum(["CONFORME", "PROBLEMA"]),
    observacao: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.estado !== "PROBLEMA" || v.observacao.length > 0, "Descreva o problema.");
export const checklistSchema = z.object({
  versao: z.literal(1),
  itens: z.object({
    pneus: item,
    iluminacao: item,
    freios: item,
    fluidos: item,
    equipamentos: item,
    limpeza: item,
  }),
});
export const kmSchema = z
  .number()
  .min(0)
  .max(99999999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use até duas casas decimais.");
export const inicioSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(["ADMINISTRATIVA", "SVO"]),
  tarefaId: z.uuid(),
  veiculoId: z.uuid(),
  kmInicial: kmSchema,
  checklist: checklistSchema,
});
export const comandoSchema = z.discriminatedUnion("tipo", [
  z.object({ id: z.uuid(), tipo: z.literal("VISITA"), ordemId: z.uuid() }),
  z.object({
    id: z.uuid(),
    tipo: z.literal("ABASTECIMENTO"),
    odometro: kmSchema,
    litros: kmSchema.refine((v) => v > 0 && v <= 999999.99, "Quantidade de litros inválida."),
    valorTotal: kmSchema.refine((v) => v > 0, "Valor deve ser maior que zero."),
    fornecedorId: z.uuid().optional(),
    dataHora: z.iso.datetime({ offset: true }),
  }),
  z.object({
    id: z.uuid(),
    tipo: z.literal("ENCERRAR"),
    kmFinal: kmSchema,
    checklist: checklistSchema,
    ocorrencias: z.string().max(4000).default(""),
    dataHora: z.iso.datetime({ offset: true }),
  }),
]);
export const posicoesSchema = z.object({
  posicoes: z
    .array(
      z.object({
        id: z.uuid(),
        coordenadas: coordenadasSchema,
        capturadaEm: z.iso.datetime({ offset: true }),
        precisao: z.number().min(0).max(100000),
        velocidade: z.number().min(0).max(200).nullable().optional(),
        direcao: z.number().min(0).max(360).nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
});
export const pontoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  coordenadas: coordenadasSchema.nullable(),
});
export type Ponto = z.infer<typeof pontoSchema>;
export function checklistImpedeSaida(checklist: z.infer<typeof checklistSchema>) {
  return (["pneus", "iluminacao", "freios"] as const).some(
    (k) => checklist.itens[k].estado === "PROBLEMA",
  );
}
