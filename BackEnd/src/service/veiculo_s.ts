import { Prisma, type Veiculo } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http_error";
import { registrarAuditoria } from "./auditoria_s";
import { invalidarCacheSincronizacaoNotificacoes } from "./notificacao_sync_cache";

// validar

export const TIPOS_FROTA = ["ADMINISTRATIVA", "SVO"] as const;
export const STATUS_VEICULO = ["DISPONIVEL", "EM_VIAGEM", "MANUTENCAO", "DESINFECCAO"] as const;
const PROPRIEDADES = ["PROPRIO", "LOCADO"] as const;

export type TipoFrota = (typeof TIPOS_FROTA)[number];
export type StatusVeiculo = (typeof STATUS_VEICULO)[number];
export type Propriedade = (typeof PROPRIEDADES)[number];

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

// Formatacao
export function normalizarPlaca(valor: string): string {
  return valor.replace(/[\s-]/g, "").toUpperCase();
}

const placaSchema = z
  .string({ error: "Placa é obrigatória." })
  .transform(normalizarPlaca)
  .pipe(z.string().regex(PLACA_REGEX, "Placa inválida. Use o padrão ABC1234 ou ABC1D23."));

const anoMaximo = () => new Date().getFullYear() + 1;

const camposVeiculo = {
  sedeId: z.uuid().nullable().optional(),
  foraDeSede: z.boolean().optional(),
  placa: placaSchema,
  modelo: z
    .string({ error: "Modelo é obrigatório." })
    .trim()
    .min(2, "Modelo deve ter ao menos 2 caracteres.")
    .max(100, "Modelo deve ter no máximo 100 caracteres."),
  tipoFrota: z.enum(TIPOS_FROTA, {
    error: "Selecione a frota administrativa ou a frota do SVO.",
  }),
  propriedade: z.enum(PROPRIEDADES, { error: "Informe se o veículo é próprio ou locado." }),
  fornecedorId: z.uuid({ error: "Selecione um fornecedor válido." }),
  ano: z
    .number({ error: "Informe um ano válido para o veículo." })
    .int("Ano deve ser inteiro.")
    .min(1950, "Ano inválido.")
    .refine((ano) => ano <= anoMaximo(), "Ano inválido."),
  combustivel: z.string().trim().min(1).max(30, "Combustível deve ter no máximo 30 caracteres."),
  capacidadeMaxima: z
    .number({ error: "Informe a quantidade de passageiros que o veículo comporta." })
    .int("Capacidade deve ser inteira.")
    .min(1, "Capacidade deve ser maior que zero.")
    .max(50, "Capacidade máxima excedida."),
  odometroAtual: z
    .number({ error: "Informe a quilometragem exibida no odômetro." })
    .min(0, "Odômetro não pode ser negativo.")
    .max(99999999.99, "Odômetro inválido."),
  kmProximaRevisao: z
    .number({ error: "Informe a quilometragem da próxima revisão." })
    .positive("A quilometragem da revisão deve ser maior que zero.")
    .max(99999999.99, "Quilometragem da revisão inválida.")
    .refine(
      (valor) => new Prisma.Decimal(valor).decimalPlaces() <= 2,
      "Use no máximo 2 casas decimais.",
    )
    .nullable()
    .optional(),
  status: z.enum(STATUS_VEICULO, { error: "Selecione uma situação válida para o veículo." }),
};

export const criarVeiculoSchema = z
  .object({
    ...camposVeiculo,
    propriedade: camposVeiculo.propriedade.default("PROPRIO"),
    fornecedorId: camposVeiculo.fornecedorId.optional(),
    ano: camposVeiculo.ano.optional(),
    combustivel: camposVeiculo.combustivel.optional(),
    capacidadeMaxima: camposVeiculo.capacidadeMaxima.default(4),
    odometroAtual: camposVeiculo.odometroAtual.default(0),
    status: camposVeiculo.status.default("DISPONIVEL"),
  })
  .superRefine((veiculo, ctx) => {
    if (veiculo.propriedade === "LOCADO" && !veiculo.fornecedorId) {
      ctx.addIssue({
        code: "custom",
        path: ["fornecedorId"],
        message: "Veículo locado exige o fornecedor (locadora).",
      });
    }
    if (veiculo.status === "DESINFECCAO" && veiculo.tipoFrota !== "SVO") {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "A desinfecção é exclusiva das viaturas do SVO.",
      });
    }
  });

export const listarVeiculosSchema = z.object({
  sede: z.union([z.uuid(), z.enum(["SEM_SEDE", "FORA_DE_SEDE"])]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipoFrota: z.enum(TIPOS_FROTA).optional(),
  status: z.enum(STATUS_VEICULO).optional(),
  propriedade: z.enum(PROPRIEDADES).optional(),
  fornecedorId: camposVeiculo.fornecedorId.optional(),
  ativo: z
    .enum(["true", "false"])
    .default("true")
    .transform((valor) => valor === "true"),
  busca: z.string().trim().max(100).optional(),
});

export type CriarVeiculoInput = z.infer<typeof criarVeiculoSchema>;
export type ListarVeiculosFiltros = z.infer<typeof listarVeiculosSchema>;

// Servico

export type VeiculoResposta = Omit<Veiculo, "odometroAtual" | "kmProximaRevisao"> & {
  odometroAtual: number;
  kmProximaRevisao: number | null;
};

export function serializarVeiculo(veiculo: Veiculo): VeiculoResposta {
  return {
    ...veiculo,
    odometroAtual: Number(veiculo.odometroAtual),
    kmProximaRevisao: veiculo.kmProximaRevisao == null ? null : Number(veiculo.kmProximaRevisao),
  };
}

export async function listarVeiculos(filtros: ListarVeiculosFiltros) {
  const { page, pageSize, tipoFrota, status, propriedade, fornecedorId, ativo, busca } = filtros;

  const where: Prisma.VeiculoWhereInput = {
    ativo,
    ...(filtros.sede === "SEM_SEDE"
      ? { sedeId: null, foraDeSede: false }
      : filtros.sede === "FORA_DE_SEDE"
        ? { foraDeSede: true }
        : filtros.sede
          ? { sedeId: filtros.sede }
          : {}),
    ...(tipoFrota ? { tipoFrota } : {}),
    ...(status ? { status } : {}),
    ...(propriedade ? { propriedade } : {}),
    ...(fornecedorId ? { fornecedorId } : {}),
    ...(busca
      ? {
          OR: [
            { placa: { contains: normalizarPlaca(busca) } },
            { modelo: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [veiculos, total] = await Promise.all([
    prisma.veiculo.findMany({
      where,
      include: { sede: true },
      orderBy: [{ placa: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.veiculo.count({ where }),
  ]);

  return {
    data: veiculos.map(serializarVeiculo),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function criarVeiculo(input: CriarVeiculoInput, usuarioId: string) {
  const placaJaExiste = await prisma.veiculo.findUnique({
    where: { placa: input.placa },
    select: { id: true },
  });
  if (placaJaExiste) {
    throw erroPlacaDuplicada();
  }

  if (input.fornecedorId) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: input.fornecedorId },
      select: { ativo: true },
    });
    if (!fornecedor?.ativo) {
      throw new HttpError(422, "Fornecedor não encontrado ou inativo.", [
        { campo: "fornecedorId", mensagem: "Informe um fornecedor ativo." },
      ]);
    }
  }

  let veiculo: Veiculo;
  try {
    veiculo =
      input.sedeId || input.foraDeSede
        ? await prisma.$transaction(async (tx) => {
            await validarSede(tx, input.sedeId, input.foraDeSede);
            const criado = await tx.veiculo.create({
              data: { ...input, sedeAtualizadaEm: new Date() },
              include: { sede: true },
            });
            await auditarSede(tx, criado, null, usuarioId);
            return criado;
          })
        : await prisma.veiculo.create({ data: input });
  } catch (error) {
    // Caso tenha duas requisicoes com a mesma placa
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw erroPlacaDuplicada();
    }
    throw error;
  }

  const resposta = serializarVeiculo(veiculo);
  invalidarCacheSincronizacaoNotificacoes();
  try {
    await registrarAuditoria({
      usuarioId,
      acao: "CRIAR",
      tabelaAfetada: "veiculos",
      registroId: veiculo.id,
      dadosNovos: JSON.parse(JSON.stringify(resposta)),
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria do veículo", veiculo.id, erro);
  }

  return resposta;
}

function erroPlacaDuplicada() {
  return new HttpError(409, "Já existe um veículo cadastrado com esta placa.", [
    { campo: "placa", mensagem: "Placa já cadastrada." },
  ]);
}

export const atualizarVeiculoSchema = z
  .object({
    ...camposVeiculo,
    fornecedorId: camposVeiculo.fornecedorId.nullable(),
    ano: camposVeiculo.ano.nullable(),
    combustivel: camposVeiculo.combustivel.nullable(),
    ativo: z.boolean(),
  })
  .partial()
  .strict()
  .superRefine((dados, ctx) => {
    if (dados.status === "DESINFECCAO" && dados.tipoFrota === "ADMINISTRATIVA") {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "A desinfecção é exclusiva das viaturas do SVO.",
      });
    }
  });

export type AtualizarVeiculoInput = z.infer<typeof atualizarVeiculoSchema>;

export async function atualizarVeiculo(
  id: string,
  input: AtualizarVeiculoInput,
  usuarioId: string,
) {
  const atual = await prisma.veiculo.findUnique({
    where: { id },
  });

  if (!atual) {
    throw new HttpError(404, "Veículo não encontrado.");
  }

  // Combina os dados existentes com os dados enviados no PATCH.
  const tipoFrota = input.tipoFrota ?? atual.tipoFrota;
  const propriedade = input.propriedade ?? atual.propriedade;
  const fornecedorId = input.fornecedorId !== undefined ? input.fornecedorId : atual.fornecedorId;
  const status = input.status ?? atual.status;

  if (propriedade === "LOCADO" && !fornecedorId) {
    throw new HttpError(422, "Veículo locado exige uma locadora.");
  }

  if (status === "DESINFECCAO" && tipoFrota !== "SVO") {
    throw new HttpError(422, "A desinfecção é exclusiva das viaturas do SVO.");
  }

  if (fornecedorId) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: fornecedorId },
      select: { ativo: true },
    });

    if (!fornecedor?.ativo) {
      throw new HttpError(422, "Fornecedor não encontrado ou inativo.");
    }
  }

  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar.");
  }

  const dadosAtualizados = {
    ...input,
  };

  let veiculo: Veiculo;

  try {
    veiculo =
      input.sedeId !== undefined || input.foraDeSede !== undefined
        ? await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM veiculos WHERE id = ${id}::uuid FOR UPDATE`;
            const anterior = await tx.veiculo.findUniqueOrThrow({
              where: { id },
              include: { sede: true },
            });
            const sedeId =
              input.sedeId !== undefined
                ? input.sedeId
                : input.foraDeSede === true
                  ? null
                  : anterior.sedeId;
            const foraDeSede = input.foraDeSede ?? (input.sedeId ? false : anterior.foraDeSede);
            await validarSede(tx, sedeId, foraDeSede, anterior.sedeId);
            const mudou = sedeId !== anterior.sedeId || foraDeSede !== anterior.foraDeSede;
            const atualizado = await tx.veiculo.update({
              where: { id },
              data: {
                ...dadosAtualizados,
                sedeId,
                foraDeSede,
                ...(mudou ? { sedeAtualizadaEm: new Date() } : {}),
              },
              include: { sede: true },
            });
            if (mudou) await auditarSede(tx, atualizado, anterior, usuarioId);
            return atualizado;
          })
        : await prisma.veiculo.update({
            where: { id },
            data: dadosAtualizados,
            include: { sede: true },
          });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw erroPlacaDuplicada();
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Veículo não encontrado.");
    }
    throw error;
  }

  const resposta = serializarVeiculo(veiculo);
  invalidarCacheSincronizacaoNotificacoes();

  try {
    await registrarAuditoria({
      usuarioId,
      acao: "ATUALIZAR",
      tabelaAfetada: "veiculos",
      registroId: veiculo.id,
      dadosNovos: JSON.parse(JSON.stringify(resposta)),
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria do veículo", veiculo.id, erro);
  }
  return resposta;
}

async function validarSede(
  tx: Prisma.TransactionClient,
  sedeId?: string | null,
  foraDeSede?: boolean,
  anterior?: string | null,
) {
  if (sedeId && foraDeSede)
    throw new HttpError(422, "Um veículo fora de sede não pode ter uma sede selecionada.");
  if (sedeId) {
    const sede = await tx.sede.findUnique({ where: { id: sedeId } });
    if (!sede || (!sede.ativo && sedeId !== anterior))
      throw new HttpError(422, "Selecione uma sede ativa.");
  }
}
async function auditarSede(
  tx: Prisma.TransactionClient,
  novo: Veiculo & { sede: { nome: string } | null },
  anterior: (Veiculo & { sede: { nome: string } | null }) | null,
  usuarioId: string,
) {
  const local = (v: typeof anterior) => ({
    sedeId: v?.sedeId ?? null,
    nome: v?.sede?.nome ?? null,
    foraDeSede: v?.foraDeSede ?? false,
  });
  await tx.auditoriaSistema.create({
    data: {
      usuarioId,
      acao: "ALTERAR_SEDE",
      tabelaAfetada: "veiculos",
      registroId: novo.id,
      dadosNovos: {
        veiculo: { id: novo.id, placa: novo.placa },
        sedeAnterior: local(anterior),
        novaSede: local(novo),
        horario: novo.sedeAtualizadaEm!.toISOString(),
      },
    },
  });
}
