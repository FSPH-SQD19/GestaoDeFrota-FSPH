import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, type UsuarioAutenticado } from "../middleware/http_m";
import {
  inicioSchema,
  comandoSchema,
  posicoesSchema,
  checklistImpedeSaida,
  pontoSchema,
  type Ponto,
} from "./diario_rules";
import { criarAbastecimento, criarAbastecimentoSchema } from "./abastecimento_s";
import { exigirDocumentosEmDia } from "./documento_veiculo_s";
import { diarioConfig } from "../config/diario";
type Tx = Prisma.TransactionClient;
const relations = { ordens: true } as const;
async function transacionar<T>(operation: (tx: Tx) => Promise<T>, options: { timeout: number }) {
  try {
    return await prisma.$transaction(operation, options);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034", "P2028"].includes(error.code)
    )
      throw new HttpError(409, "Conflito com outra operação. Atualize os dados e tente novamente.");
    throw error;
  }
}
export async function bloquearSaida(tx: Tx, motoristaId: string, veiculoId: string) {
  for (const key of [`motorista:${motoristaId}`, `veiculo:${veiculoId}`].sort())
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function motoristaDoUsuario(usuario: UsuarioAutenticado) {
  const motorista = await prisma.motorista.findUnique({ where: { usuarioId: usuario.id } });
  if (!motorista?.ativo) throw new HttpError(403, "Motorista ativo não encontrado.");
  return motorista;
}
export async function saidaAutorizada(id: string, usuario: UsuarioAutenticado, gestao = false) {
  const saida = await prisma.saidaOperacional.findUnique({ where: { id }, include: relations });
  if (!saida) throw new HttpError(404, "Saída não encontrada.");
  if (
    gestao &&
    (usuario.perfis.includes("ADMIN") ||
      usuario.perfis.includes(saida.tipo === "SVO" ? "SVO" : "GESTOR"))
  )
    return saida;
  const motorista = await motoristaDoUsuario(usuario);
  if (saida.motoristaId !== motorista.id) throw new HttpError(403, "Saída de outro motorista.");
  return saida;
}
function coords(v: number[]): [number, number] | null {
  return v.length === 2 ? [v[0], v[1]] : null;
}
export async function tarefas(usuario: UsuarioAutenticado) {
  const motorista = await motoristaDoUsuario(usuario);
  const [administrativas, ordens, saidas, sessao] = await Promise.all([
    prisma.solicitacaoViagem.findMany({
      where: { motoristaAlocadoId: motorista.id, status: "APROVADA" },
      include: { veiculoAlocado: true },
      orderBy: { dataHoraPretendida: "asc" },
    }),
    prisma.ordemColetaSvo.findMany({
      where: {
        motoristaId: motorista.id,
        status: { in: ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"] },
      } as Prisma.OrdemColetaSvoWhereInput,
      include: { chamado: true, veiculo: true },
      orderBy: [{ sequencia: "asc" }, { id: "asc" }],
    }),
    prisma.saidaOperacional.findMany({
      where: { motoristaId: motorista.id },
      include: relations,
      orderBy: { inicio: "desc" },
      take: 30,
    }),
    usuario.sessaoId
      ? prisma.authSessao.findUnique({
          where: { id: usuario.sessaoId },
          select: { expiraEm: true },
        })
      : Promise.resolve(null),
  ]);
  // Unsupported geometry is read through PostGIS, never exposed as a Prisma scalar.
  const geo = await prisma.$queryRaw<
    Array<{ id: string; coordenadas: number[] | null }>
  >`SELECT id, CASE WHEN localizacao_geo IS NULL THEN NULL ELSE ARRAY[ST_X(localizacao_geo),ST_Y(localizacao_geo)] END AS coordenadas FROM chamados_svo WHERE id IN (SELECT chamado_id FROM ordens_coleta_svo WHERE motorista_id=${motorista.id}::uuid)`;
  return {
    motorista,
    administrativas,
    ordens: ordens.map((o) => ({
      ...o,
      coordenadas: geo.find((g) => g.id === o.chamadoId)?.coordenadas ?? null,
    })),
    ativa: saidas.find((s) => s.status === "EM_ANDAMENTO") ?? null,
    historico: saidas.filter((s) => s.status === "CONCLUIDA"),
    sessaoExpiraEm: sessao?.expiraEm ?? null,
  };
}
export async function iniciarSaida(
  input: z.infer<typeof inicioSchema>,
  usuario: UsuarioAutenticado,
) {
  if (checklistImpedeSaida(input.checklist))
    throw new HttpError(422, "Problemas em pneus, iluminação ou freios impedem a saída.");
  const motorista = await motoristaDoUsuario(usuario);
  return transacionar(
    async (tx) => {
      await bloquearSaida(tx, motorista.id, input.veiculoId);
      const existente = await tx.saidaOperacional.findUnique({
        where: { id: input.id },
        include: relations,
      });
      if (existente) {
        if (
          existente.motoristaId !== motorista.id ||
          existente.veiculoId !== input.veiculoId ||
          existente.tipo !== input.tipo ||
          (input.tipo === "ADMINISTRATIVA"
            ? existente.solicitacaoId !== input.tarefaId
            : !existente.ordens.some((o) => o.ordemId === input.tarefaId))
        )
          throw new HttpError(409, "Identificador de início já utilizado.");
        return existente;
      }
      const [veiculo, condutor, ativa] = await Promise.all([
        tx.veiculo.findUnique({ where: { id: input.veiculoId } }),
        tx.motorista.findUnique({ where: { id: motorista.id } }),
        tx.saidaOperacional.findFirst({
          where: {
            status: "EM_ANDAMENTO",
            OR: [{ motoristaId: motorista.id }, { veiculoId: input.veiculoId }],
          },
        }),
      ]);
      if (ativa) throw new HttpError(409, "Motorista ou veículo já possui saída em andamento.");
      if (
        !veiculo?.ativo ||
        veiculo.tipoFrota !== input.tipo ||
        !["DISPONIVEL", ...(input.tipo === "SVO" ? ["EM_VIAGEM"] : [])].includes(veiculo.status)
      )
        throw new HttpError(422, "Veículo indisponível.");
      if (
        !condutor?.ativo ||
        !["DISPONIVEL", ...(input.tipo === "SVO" ? ["OCUPADO"] : [])].includes(condutor.status) ||
        condutor.validadeCnh.toISOString().slice(0, 10) <
          new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
      )
        throw new HttpError(422, "Motorista indisponível ou CNH vencida.");
      if (input.kmInicial < Number(veiculo.odometroAtual))
        throw new HttpError(422, "Odômetro inicial menor que o registrado no veículo.");
      await exigirDocumentosEmDia(
        tx,
        veiculo.id,
        new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      );
      let solicitacaoId: string | undefined;
      let ordensIds: string[] = [];
      let pontos: Ponto[] = [];
      if (input.tipo === "ADMINISTRATIVA") {
        const tarefa = await tx.solicitacaoViagem.findUnique({ where: { id: input.tarefaId } });
        if (
          !tarefa ||
          tarefa.motoristaAlocadoId !== motorista.id ||
          tarefa.veiculoAlocadoId !== veiculo.id ||
          tarefa.status !== "APROVADA"
        )
          throw new HttpError(403, "Viagem não atribuída ou indisponível.");
        const conflito = await tx.ordemColetaSvo.count({
          where: {
            motoristaId: motorista.id,
            status: { in: ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"] },
          },
        });
        if (conflito) throw new HttpError(409, "Motorista alocado em operação SVO.");
        solicitacaoId = tarefa.id;
        pontos = [
          {
            id: "origem",
            nome: tarefa.origem ?? "Origem",
            coordenadas: coords(tarefa.origemCoordenadas),
          },
          {
            id: "destino",
            nome: tarefa.destino ?? "Destino",
            coordenadas: coords(tarefa.destinoCoordenadas),
          },
        ];
        await tx.solicitacaoViagem.update({
          where: { id: tarefa.id },
          data: { status: "EM_TRANSITO" },
        });
        await tx.execucaoViagem.upsert({
          where: { solicitacaoId: tarefa.id },
          create: {
            solicitacaoId: tarefa.id,
            dataHoraInicio: new Date(),
            kmInicial: input.kmInicial,
            checklistSaida: input.checklist,
          },
          update: {
            dataHoraInicio: new Date(),
            kmInicial: input.kmInicial,
            checklistSaida: input.checklist,
          },
        });
      } else {
        const ordens = await tx.ordemColetaSvo.findMany({
          where: {
            motoristaId: motorista.id,
            veiculoId: veiculo.id,
            status: { in: ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO"] },
          },
          include: { chamado: true },
          orderBy: [{ sequencia: "asc" }, { id: "asc" }],
        });
        if (!ordens.some((o) => o.id === input.tarefaId))
          throw new HttpError(403, "Ordem não atribuída.");
        if (ordens.length > veiculo.capacidadeMaxima)
          throw new HttpError(422, "Capacidade da viatura excedida.");
        const conflito = await tx.solicitacaoViagem.count({
          where: {
            motoristaAlocadoId: motorista.id,
            status: { in: ["APROVADA", "EM_TRANSITO"] },
            OR: [{ status: "EM_TRANSITO" }, { dataHoraRetornoPrevista: { gte: new Date() } }],
          },
        });
        if (conflito) throw new HttpError(409, "Motorista alocado em viagem administrativa.");
        const geo = await tx.$queryRaw<
          Array<{ id: string; coordenadas: number[] | null }>
        >`SELECT id, CASE WHEN localizacao_geo IS NULL THEN NULL ELSE ARRAY[ST_X(localizacao_geo),ST_Y(localizacao_geo)] END AS coordenadas FROM chamados_svo WHERE id IN (SELECT chamado_id FROM ordens_coleta_svo WHERE motorista_id=${motorista.id}::uuid AND veiculo_id=${veiculo.id}::uuid)`;
        ordensIds = ordens.map((o) => o.id);
        pontos = ordens.map((o) => ({
          id: o.id,
          nome: o.chamado.enderecoOcorrencia ?? "Coleta",
          coordenadas: coords(geo.find((g) => g.id === o.chamadoId)?.coordenadas ?? []),
        }));
        pontos.push({
          id: "base",
          nome: "Retorno à base",
          coordenadas: coords(ordens[0].baseCoordenadas),
        });
        await tx.ordemColetaSvo.updateMany({
          where: { id: { in: ordensIds } },
          data: { status: "EM_ANDAMENTO", dataHoraSaida: new Date() },
        });
      }
      const saida = await tx.saidaOperacional.create({
        data: {
          id: input.id,
          tipo: input.tipo,
          motoristaId: motorista.id,
          veiculoId: veiculo.id,
          solicitacaoId,
          kmInicial: input.kmInicial,
          checklistSaida: input.checklist,
          pontos,
          ordens: { create: ordensIds.map((ordemId) => ({ ordemId })) },
        },
        include: relations,
      });
      await tx.veiculo.update({
        where: { id: veiculo.id },
        data: { status: "EM_VIAGEM", odometroAtual: input.kmInicial },
      });
      await tx.motorista.update({ where: { id: motorista.id }, data: { status: "OCUPADO" } });
      await auditar(tx, usuario.id, saida.id, "INICIAR_SAIDA");
      return saida;
    },
    { timeout: 15000 },
  );
}
async function auditar(tx: Tx, usuarioId: string, id: string, acao: string) {
  await tx.auditoriaSistema.create({
    data: { usuarioId, acao, tabelaAfetada: "saidas_operacionais", registroId: id },
  });
}
export async function executarComando(
  id: string,
  comando: z.infer<typeof comandoSchema>,
  usuario: UsuarioAutenticado,
) {
  const ref = await saidaAutorizada(id, usuario);
  return transacionar(
    async (tx) => {
      await bloquearSaida(tx, ref.motoristaId, ref.veiculoId);
      const saida = await tx.saidaOperacional.findUniqueOrThrow({
        where: { id },
        include: relations,
      });
      const anterior = await tx.comandoSaida.findUnique({ where: { id: comando.id } });
      if (anterior) {
        if (anterior.saidaId !== id || !mesmoJson(anterior.payload, comando))
          throw new HttpError(409, "Identificador de comando já utilizado.");
        return saida;
      }
      if (saida.status !== "EM_ANDAMENTO") throw new HttpError(409, "Saída já encerrada.");
      if (comando.tipo === "VISITA") {
        const ordem = saida.ordens.find((o) => o.ordemId === comando.ordemId);
        if (!ordem) throw new HttpError(403, "Ordem não pertence à saída.");
        const pontos = z.array(pontoSchema).parse(saida.pontos);
        const proxima = pontos.find(
          (p) => p.id !== "base" && !saida.ordens.find((o) => o.ordemId === p.id)?.visitadaEm,
        );
        if (!ordem.visitadaEm && proxima?.id !== comando.ordemId)
          throw new HttpError(409, "Siga a sequência de coletas definida pela central.");
        if (!ordem.visitadaEm)
          await tx.saidaOrdem.update({
            where: { ordemId: comando.ordemId },
            data: { visitadaEm: new Date() },
          });
      } else if (comando.tipo === "ABASTECIMENTO") {
        validarHorario(comando.dataHora, saida.inicio);
        if (comando.odometro < Number(saida.kmInicial))
          throw new HttpError(422, "Odômetro abaixo da saída.");
        const dados = criarAbastecimentoSchema.parse({
          ...comando,
          veiculoId: saida.veiculoId,
          motoristaId: saida.motoristaId,
        });
        await criarAbastecimento(dados, usuario.id, tx);
      } else {
        validarHorario(comando.dataHora, saida.inicio);
        const veiculo = await tx.veiculo.findUniqueOrThrow({ where: { id: saida.veiculoId } });
        const ultimo = await tx.abastecimento.findFirst({
          where: { veiculoId: saida.veiculoId, dataHora: { gte: saida.inicio } },
          orderBy: { odometro: "desc" },
        });
        if (
          comando.kmFinal <
          Math.max(
            Number(saida.kmInicial),
            Number(veiculo.odometroAtual),
            Number(ultimo?.odometro ?? 0),
          )
        )
          throw new HttpError(422, "Odômetro final menor que o já registrado.");
        if (saida.ordens.some((o) => !o.visitadaEm))
          throw new HttpError(409, "Registre todas as coletas antes de retornar à base.");
        await tx.saidaOperacional.update({
          where: { id },
          data: {
            status: "CONCLUIDA",
            fim: new Date(comando.dataHora),
            kmFinal: comando.kmFinal,
            checklistRetorno: comando.checklist,
            ocorrencias: comando.ocorrencias,
          },
        });
        if (saida.solicitacaoId) {
          await tx.solicitacaoViagem.update({
            where: { id: saida.solicitacaoId },
            data: { status: "CONCLUIDA" },
          });
          await tx.execucaoViagem.update({
            where: { solicitacaoId: saida.solicitacaoId },
            data: {
              dataHoraFim: new Date(comando.dataHora),
              kmFinal: comando.kmFinal,
              checklistRetorno: comando.checklist,
            },
          });
        } else {
          await tx.ordemColetaSvo.updateMany({
            where: { id: { in: saida.ordens.map((o) => o.ordemId) } },
            data: { status: "CONCLUIDA" },
          });
          await tx.desinfeccaoSvo.create({
            data: { veiculoId: saida.veiculoId, status: "EM_ANDAMENTO", responsavelId: usuario.id },
          });
        }
        await tx.veiculo.update({
          where: { id: saida.veiculoId },
          data: {
            status: saida.tipo === "SVO" ? "DESINFECCAO" : "DISPONIVEL",
            odometroAtual: comando.kmFinal,
          },
        });
        await tx.motorista.update({
          where: { id: saida.motoristaId },
          data: { status: "DISPONIVEL" },
        });
      }
      await tx.comandoSaida.create({
        data: { id: comando.id, saidaId: id, tipo: comando.tipo, payload: comando },
      });
      await auditar(tx, usuario.id, id, comando.tipo);
      return tx.saidaOperacional.findUniqueOrThrow({ where: { id }, include: relations });
    },
    { timeout: 15000 },
  );
}
function mesmoJson(a: unknown, b: unknown): boolean {
  const normal = (v: unknown): string =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x,
    );
  return normal(a) === normal(b);
}
function validarHorario(value: string, inicio: Date) {
  const t = Date.parse(value);
  if (t < inicio.getTime() || t > Date.now() + 60000)
    throw new HttpError(422, "Horário fora do período da saída.");
}
export async function registrarPosicoes(
  id: string,
  input: z.infer<typeof posicoesSchema>,
  usuario: UsuarioAutenticado,
) {
  const ref = await saidaAutorizada(id, usuario);
  return transacionar(
    async (tx) => {
      await bloquearSaida(tx, ref.motoristaId, ref.veiculoId);
      const saida = await tx.saidaOperacional.findUniqueOrThrow({ where: { id } });
      for (const p of input.posicoes) {
        validarHorario(p.capturadaEm, saida.inicio);
        if (saida.fim && Date.parse(p.capturadaEm) > saida.fim.getTime())
          throw new HttpError(422, "Posição posterior ao encerramento.");
        const [lng, lat] = p.coordenadas;
        const inserted =
          await tx.$executeRaw`INSERT INTO posicoes_saida (id,saida_id,ponto,capturada_em,precisao,velocidade,direcao) VALUES (${p.id}::uuid,${id}::uuid,ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography,${new Date(p.capturadaEm)},${p.precisao},${p.velocidade ?? null},${p.direcao ?? null}) ON CONFLICT (id) DO NOTHING`;
        if (inserted)
          await tx.$executeRaw`INSERT INTO ultimas_posicoes_saida (saida_id,amostra_id,ponto,capturada_em,precisao) VALUES (${id}::uuid,${p.id}::uuid,ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography,${new Date(p.capturadaEm)},${p.precisao}) ON CONFLICT (saida_id) DO UPDATE SET amostra_id=EXCLUDED.amostra_id,ponto=EXCLUDED.ponto,capturada_em=EXCLUDED.capturada_em,recebida_em=now(),precisao=EXCLUDED.precisao WHERE EXCLUDED.capturada_em>ultimas_posicoes_saida.capturada_em`;
      }
      return { aceitas: input.posicoes.map((p) => p.id) };
    },
    { timeout: 15000 },
  );
}
export async function calcularRota(
  id: string,
  origem: [number, number],
  usuario: UsuarioAutenticado,
) {
  const saida = await saidaAutorizada(id, usuario);
  if (saida.status !== "EM_ANDAMENTO") throw new HttpError(409, "Saída encerrada.");
  const pontos = z.array(pontoSchema).parse(saida.pontos);
  const ponto =
    saida.tipo === "SVO"
      ? pontos.find(
          (p) => p.id === "base" || !saida.ordens.find((o) => o.ordemId === p.id)?.visitadaEm,
        )
      : pontos.find((p) => p.id === "destino");
  if (!ponto?.coordenadas)
    throw new HttpError(422, "Rota indisponível: confirme as coordenadas com a central.");
  const config = diarioConfig();
  if (!config.osrmUrl) throw new HttpError(503, "Serviço de rotas não configurado.");
  const url = new URL(
    `route/v1/driving/${origem.join(",")};${ponto.coordenadas.join(",")}`,
    config.osrmUrl.replace(/\/?$/, "/"),
  );
  url.search = new URLSearchParams({
    steps: "true",
    geometries: "geojson",
    overview: "full",
    radiuses: "100;100",
  }).toString();
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: config.osrmToken ? { Authorization: `Bearer ${config.osrmToken}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("OSRM HTTP");
    const data = (await response.json()) as {
      code: string;
      routes?: Array<{
        geometry: { type: string; coordinates: number[][] };
        distance: number;
        duration: number;
        legs: Array<{
          steps: Array<{
            name: string;
            distance: number;
            maneuver: { type: string; modifier?: string };
          }>;
        }>;
      }>;
    };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route)
      throw new HttpError(422, "Nenhuma rota encontrada na cobertura disponível.");
    console.info(
      JSON.stringify({ evento: "osrm", duracaoMs: Date.now() - start, resultado: "ok" }),
    );
    const tipos: Record<string, string> = {
      depart: "Siga",
      arrive: "Chegue ao destino",
      turn: "Vire",
      continue: "Continue",
      roundabout: "Entre na rotatória",
      merge: "Entre na via",
      fork: "Na bifurcação siga",
    };
    const lados: Record<string, string> = {
      left: "à esquerda",
      right: "à direita",
      straight: "em frente",
      "slight left": "levemente à esquerda",
      "slight right": "levemente à direita",
      "sharp left": "acentuadamente à esquerda",
      "sharp right": "acentuadamente à direita",
      uturn: "faça o retorno",
    };
    return {
      destino: ponto,
      geometry: route.geometry,
      distancia: route.distance,
      duracao: route.duration,
      instrucoes: route.legs.flatMap((l) =>
        l.steps.map((s) => ({
          texto: `${tipos[s.maneuver.type] ?? "Siga"} ${lados[s.maneuver.modifier ?? ""] ?? ""}${s.name ? ` — ${s.name}` : ""}`,
          distancia: s.distance,
        })),
      ),
      calculadaEm: new Date().toISOString(),
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error(
      JSON.stringify({ evento: "osrm", duracaoMs: Date.now() - start, resultado: "erro" }),
    );
    throw new HttpError(503, "Serviço de rotas temporariamente indisponível.");
  }
}
export async function ultimasPosicoes(usuario: UsuarioAutenticado) {
  const admin = usuario.perfis.includes("ADMIN"),
    svo = usuario.perfis.includes("SVO"),
    gestor = usuario.perfis.includes("GESTOR");
  return prisma.$queryRaw`SELECT s.id AS "saidaId", CASE WHEN u.ponto IS NULL THEN NULL ELSE ARRAY[ST_X(u.ponto::geometry),ST_Y(u.ponto::geometry)] END AS coordenadas,u.capturada_em AS "capturadaEm",u.precisao,s.tipo,s.status,v.placa,us.nome FROM saidas_operacionais s LEFT JOIN ultimas_posicoes_saida u ON s.id=u.saida_id JOIN veiculos v ON v.id=s.veiculo_id JOIN motoristas m ON m.id=s.motorista_id LEFT JOIN usuarios us ON us.id=m.usuario_id WHERE s.status='EM_ANDAMENTO' AND (${admin} OR (${svo} AND s.tipo='SVO') OR (${gestor} AND s.tipo='ADMINISTRATIVA'))`;
}
export async function percurso(id: string, usuario: UsuarioAutenticado) {
  await saidaAutorizada(id, usuario, true);
  return prisma.$queryRaw`SELECT ARRAY[ST_X(ponto::geometry),ST_Y(ponto::geometry)] AS coordenadas,capturada_em AS "capturadaEm",precisao FROM posicoes_saida WHERE saida_id=${id}::uuid ORDER BY capturada_em LIMIT 20000`;
}
