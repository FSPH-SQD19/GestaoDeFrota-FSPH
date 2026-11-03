import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, usuarioAutenticado } from "../middleware/http_m";
import { HttpError } from "../lib/http_error";
import { validar } from "../lib/validar";
import { diarioConfig } from "../config/diario";
import {
  coordenadasSchema,
  inicioSchema,
  comandoSchema,
  posicoesSchema,
} from "../service/diario_rules";
import {
  tarefas,
  iniciarSaida,
  saidaAutorizada,
  executarComando,
  registrarPosicoes,
  calcularRota,
  ultimasPosicoes,
  percurso,
  bloquearSaida,
} from "../service/diario_s";
const router = Router();
router.get("/motorista/config", authenticate, (_req, res) =>
  res.json({ enabled: diarioConfig().enabled }),
);
router.use(
  ["/motorista", "/rastreamento", "/locais", "/geografia"],
  authenticate,
  (_req, _res, next) => {
    if (!diarioConfig().enabled)
      return next(new HttpError(404, "Módulo do motorista não habilitado."));
    next();
  },
);
router.use("/motorista", requireRole("MOTORISTA"));
router.param("id", (req, _res, next) => {
  try {
    validar(z.uuid(), req.params.id);
    next();
  } catch (e) {
    next(e);
  }
});
router.get("/motorista/fornecedores", async (_req, res) =>
  res.json(
    await prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    }),
  ),
);
router.get("/motorista/tarefas", async (_req, res) =>
  res.json(await tarefas(usuarioAutenticado(res))),
);
router.post("/motorista/saidas", async (req, res) =>
  res
    .status(201)
    .json(await iniciarSaida(validar(inicioSchema, req.body), usuarioAutenticado(res))),
);
router.get("/motorista/saidas/:id", async (req, res) =>
  res.json(await saidaAutorizada(String(req.params.id), usuarioAutenticado(res))),
);
router.post("/motorista/saidas/:id/comandos", async (req, res) =>
  res.json(
    await executarComando(
      String(req.params.id),
      validar(comandoSchema, req.body),
      usuarioAutenticado(res),
    ),
  ),
);
router.post("/motorista/saidas/:id/posicoes", async (req, res) =>
  res.json(
    await registrarPosicoes(
      String(req.params.id),
      validar(posicoesSchema, req.body),
      usuarioAutenticado(res),
    ),
  ),
);
router.post("/motorista/saidas/:id/rota", async (req, res) =>
  res.json(
    await calcularRota(
      String(req.params.id),
      validar(z.object({ origem: coordenadasSchema }), req.body).origem,
      usuarioAutenticado(res),
    ),
  ),
);
router.use("/rastreamento", requireRole("ADMIN", "GESTOR", "SVO"));
router.get("/rastreamento/saidas", async (_req, res) => {
  const roles = usuarioAutenticado(res).perfis;
  const tipos = roles.includes("ADMIN")
    ? ["ADMINISTRATIVA", "SVO"]
    : [
        ...(roles.includes("GESTOR") ? ["ADMINISTRATIVA"] : []),
        ...(roles.includes("SVO") ? ["SVO"] : []),
      ];
  res.json(
    await prisma.saidaOperacional.findMany({
      where: { tipo: { in: tipos } },
      select: { id: true, tipo: true, inicio: true, status: true },
      orderBy: { inicio: "desc" },
      take: 100,
    }),
  );
});
router.get("/rastreamento/posicoes", async (_req, res) =>
  res.json(await ultimasPosicoes(usuarioAutenticado(res))),
);
router.get("/rastreamento/saidas/:id/percurso", async (req, res) =>
  res.json(await percurso(String(req.params.id), usuarioAutenticado(res))),
);
router.use("/locais", requireRole("ADMIN", "GESTOR", "SVO"));
router.get("/locais", async (_req, res) =>
  res.json(await prisma.localOperacional.findMany({ orderBy: { nome: "asc" } })),
);
router.post("/locais", async (req, res) =>
  res.status(201).json(
    await prisma.localOperacional.create({
      data: validar(
        z.object({
          nome: z.string().trim().min(2).max(150),
          coordenadas: coordenadasSchema,
          tipo: z.enum(["BASE", "DESTINO", "ORIGEM"]),
        }),
        req.body,
      ),
    }),
  ),
);
router.use("/geografia", requireRole("ADMIN", "GESTOR", "SVO"));
router.get("/geografia/tarefas", async (_req, res) => {
  const roles = usuarioAutenticado(res).perfis;
  const [administrativas, ordens] = await Promise.all([
    roles.some((r) => ["ADMIN", "GESTOR"].includes(r))
      ? prisma.solicitacaoViagem.findMany({
          where: { status: { in: ["PENDENTE", "APROVADA"] } },
          orderBy: { criadoEm: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    roles.some((r) => ["ADMIN", "SVO"].includes(r))
      ? prisma.ordemColetaSvo.findMany({
          where: { status: { in: ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"] } },
          include: { chamado: true },
          orderBy: { sequencia: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);
  const geo = roles.some((r) => ["ADMIN", "SVO"].includes(r))
    ? await prisma.$queryRaw<
        Array<{ id: string; coordenadas: number[] | null }>
      >`SELECT id, CASE WHEN localizacao_geo IS NULL THEN NULL ELSE ARRAY[ST_X(localizacao_geo),ST_Y(localizacao_geo)] END AS coordenadas FROM chamados_svo WHERE status_triagem='APROVADO'`
    : [];
  return res.json({
    administrativas,
    ordens: ordens.map((o) => ({
      ...o,
      coordenadas: geo.find((g) => g.id === o.chamadoId)?.coordenadas ?? null,
    })),
  });
});
router.patch("/geografia/:id", async (req, res) => {
  const input = validar(
    z.discriminatedUnion("tipo", [
      z.object({
        tipo: z.literal("ADMINISTRATIVA"),
        origem: coordenadasSchema,
        destino: coordenadasSchema,
      }),
      z.object({
        tipo: z.literal("SVO"),
        ocorrencia: coordenadasSchema,
        base: coordenadasSchema,
        sequencia: z.number().int().min(0).max(1000),
      }),
    ]),
    req.body,
  );
  const usuario = usuarioAutenticado(res),
    id = String(req.params.id);
  if (
    !usuario.perfis.includes("ADMIN") &&
    !usuario.perfis.includes(input.tipo === "SVO" ? "SVO" : "GESTOR")
  )
    throw new HttpError(403, "Operação não permitida.");
  await prisma.$transaction(async (tx) => {
    if (input.tipo === "ADMINISTRATIVA") {
      await tx.$queryRaw`SELECT id FROM solicitacoes_viagem WHERE id=${id}::uuid FOR UPDATE`;
      const tarefa = await tx.solicitacaoViagem.findUnique({ where: { id } });
      if (!tarefa || !["PENDENTE", "APROVADA"].includes(tarefa.status))
        throw new HttpError(409, "Viagem indisponível para edição.");
      await tx.solicitacaoViagem.update({
        where: { id },
        data: { origemCoordenadas: input.origem, destinoCoordenadas: input.destino },
      });
    } else {
      const ordem = await tx.ordemColetaSvo.findUnique({ where: { id } });
      if (!ordem?.motoristaId || !ordem.veiculoId)
        throw new HttpError(409, "Ordem sem recursos atribuídos.");
      await bloquearSaida(tx, ordem.motoristaId, ordem.veiculoId);
      if (await tx.saidaOrdem.findUnique({ where: { ordemId: id } }))
        throw new HttpError(409, "Saída iniciada; sequência e pontos estão bloqueados.");
      const atual = await tx.ordemColetaSvo.findUniqueOrThrow({ where: { id } });
      if (!["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"].includes(atual.status))
        throw new HttpError(409, "Ordem encerrada.");
      const [lng, lat] = input.ocorrencia;
      await tx.$executeRaw`UPDATE chamados_svo SET localizacao_geo=ST_SetSRID(ST_MakePoint(${lng},${lat}),4326) WHERE id=${ordem.chamadoId}::uuid`;
      await tx.ordemColetaSvo.update({
        where: { id },
        data: { baseCoordenadas: input.base, sequencia: input.sequencia },
      });
      await tx.ordemColetaSvo.updateMany({
        where: {
          motoristaId: ordem.motoristaId,
          veiculoId: ordem.veiculoId,
          status: "AGUARDANDO_DESPACHO",
        },
        data: { baseCoordenadas: input.base },
      });
    }
    await tx.auditoriaSistema.create({
      data: {
        usuarioId: usuario.id,
        acao: "CONFIRMAR_GEOGRAFIA",
        tabelaAfetada: input.tipo === "SVO" ? "ordens_coleta_svo" : "solicitacoes_viagem",
        registroId: id,
        dadosNovos: input,
      },
    });
  });
  res.json({ ok: true });
});
export default router;
