import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signTestToken } from "../../helpers/auth";

// Apenas persistência, sessão e notificações são simuladas. As requisições
// atravessam as rotas, validações, controladores e regras reais do SVO.
const banco = vi.hoisted(() => ({
  chamado: null as Record<string, unknown> | null,
  ordem: null as Record<string, unknown> | null,
  veiculo: {} as Record<string, unknown>,
  motorista: {} as Record<string, unknown>,
  auditorias: [] as Array<Record<string, unknown>>,
  desinfeccoes: [] as Array<Record<string, unknown>>,
}));
vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "svo-fluxo-teste", expiresIn: 28800 }),
}));
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
vi.mock("../../../src/service/notificacao_s", () => ({
  notificarViaturaSvoLiberada: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => {
  function corresponde(registro: Record<string, unknown> | null, where: Record<string, unknown>) {
    return (
      !!registro &&
      Object.entries(where).every(([campo, valor]) => {
        if (campo === "ordemColeta") return banco.ordem === null;
        if (campo === "status" && typeof valor === "object" && valor !== null) {
          return (valor as { in: unknown[] }).in.includes(registro.status);
        }
        return registro[campo] === valor;
      })
    );
  }
  const prisma = {
    $queryRaw: vi.fn(async () => [{ ultimo_valor: 1 }]),
    chamadoSvo: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        banco.chamado = {
          ...data,
          id: "00000000-0000-4000-8000-000000000010",
          statusTriagem: "EM_ANALISE",
        };
        return banco.chamado;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        banco.chamado?.id === where.id ? { ...banco.chamado, ordemColeta: banco.ordem } : null,
      findUniqueOrThrow: async () => ({ ...banco.chamado, ordemColeta: banco.ordem }),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!corresponde(banco.chamado, where)) return { count: 0 };
        Object.assign(banco.chamado!, data);
        return { count: 1 };
      },
      count: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        Number(corresponde(banco.chamado, where)),
      findMany: async () => (banco.chamado ? [{ ...banco.chamado, ordemColeta: banco.ordem }] : []),
    },
    ordemColetaSvo: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        banco.ordem = {
          id: "00000000-0000-4000-8000-000000000040",
          dataHoraChegadaLocal: null,
          dataHoraEntregaSvo: null,
          ...data,
        };
        return banco.ordem;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        banco.ordem?.id === where.id ? banco.ordem : null,
      findMany: async () => (banco.ordem ? [{ ...banco.ordem, chamado: banco.chamado }] : []),
      findFirst: async () => null,
      count: async ({ where }: { where: Record<string, unknown> }) =>
        Number(corresponde(banco.ordem, where)),
      update: async ({ data }: { data: Record<string, unknown> }) =>
        Object.assign(banco.ordem!, data),
    },
    veiculo: {
      findUnique: async () => banco.veiculo,
      count: async ({ where }: { where: Record<string, unknown> }) =>
        Number(corresponde(banco.veiculo, where)),
      update: async ({ data }: { data: Record<string, unknown> }) =>
        Object.assign(banco.veiculo, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!corresponde(banco.veiculo, where)) return { count: 0 };
        Object.assign(banco.veiculo, data);
        return { count: 1 };
      },
    },
    motorista: {
      findUnique: async () => banco.motorista,
      update: async ({ data }: { data: Record<string, unknown> }) =>
        Object.assign(banco.motorista, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!corresponde(banco.motorista, where)) return { count: 0 };
        Object.assign(banco.motorista, data);
        return { count: 1 };
      },
    },
    auditoriaSistema: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        banco.auditorias.push(data);
        return data;
      },
      findMany: async () => [],
    },
    desinfeccaoSvo: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        banco.desinfeccoes.push(data);
        return data;
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        banco.desinfeccoes.forEach((registro) => Object.assign(registro, data));
        return { count: banco.desinfeccoes.length };
      },
    },
  };
  return {
    prisma: {
      ...prisma,
      $transaction: async (operacao: (tx: unknown) => Promise<unknown>) => operacao(prisma),
    },
  };
});

import { app } from "../../../src/app";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const chamadoId = "00000000-0000-4000-8000-000000000010";
const veiculoId = "00000000-0000-4000-8000-000000000020";
const motoristaId = "00000000-0000-4000-8000-000000000030";
const ordemId = "00000000-0000-4000-8000-000000000040";
let server: Server;
let url: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/svo`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  banco.chamado = null;
  banco.ordem = null;
  banco.auditorias = [];
  banco.desinfeccoes = [];
  banco.veiculo = {
    id: veiculoId,
    placa: "SVO1A23",
    modelo: "S10",
    tipoFrota: "SVO",
    ativo: true,
    status: "DISPONIVEL",
    capacidadeMaxima: 4,
  };
  banco.motorista = {
    id: motoristaId,
    ativo: true,
    status: "DISPONIVEL",
    validadeCnh: new Date("2099-12-31"),
  };
});

async function request(method: string, path: string, body?: unknown, perfil = "SVO") {
  const resposta = await fetch(`${url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${signTestToken({ perfis: [perfil] }, "svo-fluxo-teste", { subject: usuarioId })}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: resposta.status, json: (await resposta.json()) as Record<string, unknown> };
}
async function reservar(legada = false) {
  expect(
    (
      await request("POST", "/chamados", {
        nomeFalecido: "Pessoa Teste",
        enderecoOcorrencia: "Rua das Flores, 100",
        relatoOcorrencia: "Óbito informado pela família.",
      })
    ).status,
  ).toBe(201);
  expect(
    (await request("PATCH", `/chamados/${chamadoId}/triagem`, { decisao: "APROVAR" })).status,
  ).toBe(200);
  const resposta = await request(
    "POST",
    legada ? `/chamados/${chamadoId}/ordens` : "/ordens-coleta",
    { ...(!legada && { chamadoId }), veiculoId, motoristaId },
  );
  expect(resposta.status).toBe(201);
  expect(resposta.json).toMatchObject({
    status: "AGUARDANDO_DESPACHO",
    dataHoraSaida: null,
    dataHoraChegadaLocal: null,
    dataHoraEntregaSvo: null,
  });
  expect(banco.veiculo.status).toBe("DISPONIVEL");
  expect(banco.motorista.status).toBe("OCUPADO");
}
const etapa = (status: string) => request("PATCH", `/ordens-coleta/${ordemId}/etapa`, { status });
const cancelar = () => request("PATCH", `/ordens-coleta/${ordemId}/cancelar`);

describe("fluxo HTTP SVO com controladores e serviços reais", () => {
  it.each([false, true])(
    "percorre reserva, saída, chegada, entrega e desinfecção (emissão legada: %s)",
    async (legada) => {
      await reservar(legada);
      expect((await request("GET", "/indicadores")).json.coletasEmAndamento).toBe(0);
      expect((await etapa("ENTREGUE_SVO")).status).toBe(409);
      expect((await request("PATCH", `/chamados/${chamadoId}/concluir`)).status).toBe(409);
      const saida = await etapa("EM_DESLOCAMENTO");
      expect(saida.status).toBe(200);
      expect(saida.json.dataHoraSaida).toEqual(expect.any(String));
      expect(banco.veiculo.status).toBe("EM_VIAGEM");
      expect((await request("GET", "/indicadores")).json.coletasEmAndamento).toBe(1);
      expect((await cancelar()).status).toBe(409);
      expect((await etapa("EM_DESLOCAMENTO")).status).toBe(409);
      expect((await request("PATCH", `/chamados/${chamadoId}/concluir`)).status).toBe(409);
      const chegada = await etapa("NO_LOCAL");
      expect(chegada.status).toBe(200);
      expect(chegada.json.dataHoraChegadaLocal).toEqual(expect.any(String));
      const entrega = await etapa("ENTREGUE_SVO");
      expect(entrega.status).toBe(200);
      expect(entrega.json).toMatchObject({
        status: "ENTREGUE_SVO",
        dataHoraSaida: saida.json.dataHoraSaida,
        dataHoraChegadaLocal: chegada.json.dataHoraChegadaLocal,
        dataHoraEntregaSvo: expect.any(String),
      });
      expect(banco.veiculo.status).toBe("DESINFECCAO");
      expect(banco.motorista.status).toBe("DISPONIVEL");
      expect(banco.desinfeccoes).toHaveLength(1);
      expect((await request("GET", "/indicadores")).json.coletasEmAndamento).toBe(0);
      const auditorias = banco.auditorias.length;
      expect((await etapa("ENTREGUE_SVO")).status).toBe(409);
      expect(banco.auditorias).toHaveLength(auditorias);
      expect(banco.desinfeccoes).toHaveLength(1);
      const liberada = await request("PATCH", `/viaturas/${veiculoId}/desinfeccao`);
      expect(liberada.status).toBe(200);
      expect(liberada.json.status).toBe("DISPONIVEL");
      expect(banco.auditorias.map((registro) => registro.acao)).toEqual([
        "CRIAR",
        "TRIAGEM_APROVAR",
        "EMITIR_ORDEM",
        "AVANCAR_ETAPA",
        "AVANCAR_ETAPA",
        "CONCLUIR_COLETA",
        "CONCLUIR_DESINFECCAO",
      ]);
    },
  );

  it("cancela reserva e libera recursos sem registrar saída nem desinfecção", async () => {
    await reservar();
    const resposta = await cancelar();
    expect(resposta.status).toBe(200);
    expect(resposta.json).toMatchObject({
      status: "CANCELADA",
      dataHoraSaida: null,
      dataHoraChegadaLocal: null,
      dataHoraEntregaSvo: null,
    });
    expect(banco.veiculo.status).toBe("DISPONIVEL");
    expect(banco.motorista.status).toBe("DISPONIVEL");
    expect(banco.desinfeccoes).toHaveLength(0);
    expect(banco.auditorias.at(-1)?.acao).toBe("CANCELAR_ORDEM");
    expect((await cancelar()).status).toBe(409);
    expect((await etapa("EM_DESLOCAMENTO")).status).toBe(409);
  });

  it("ordem legada EM_ANDAMENTO precisa passar pela chegada antes da conclusão antiga", async () => {
    await reservar();
    banco.ordem!.status = "EM_ANDAMENTO";
    banco.ordem!.dataHoraSaida = new Date();
    banco.veiculo.status = "EM_VIAGEM";
    expect((await request("PATCH", `/chamados/${chamadoId}/concluir`)).status).toBe(409);
    expect((await etapa("NO_LOCAL")).status).toBe(200);
    expect((await request("PATCH", `/chamados/${chamadoId}/concluir`)).json.status).toBe(
      "ENTREGUE_SVO",
    );
    expect(banco.ordem!.dataHoraChegadaLocal).toBeInstanceOf(Date);
  });

  it.each(["veiculo", "motorista"] as const)(
    "revalida %s no despacho e mantém a reserva cancelável",
    async (recurso) => {
      await reservar();
      banco[recurso].ativo = false;
      expect((await etapa("EM_DESLOCAMENTO")).status).toBe(422);
      expect(banco.ordem!.dataHoraSaida).toBeNull();
      expect(banco.ordem!.status).toBe("AGUARDANDO_DESPACHO");
      expect((await cancelar()).status).toBe(200);
    },
  );

  it("retorna 404 para ordem ausente e 400 para etapa fora do contrato", async () => {
    expect((await etapa("EM_DESLOCAMENTO")).status).toBe(404);
    expect((await cancelar()).status).toBe(404);
    expect((await etapa("CONCLUIDA")).status).toBe(400);
  });

  it("permite ao motorista listar a coleta atribuída e avançar as três etapas", async () => {
    await reservar();
    const minhas = await request("GET", "/ordens-coleta/minhas", undefined, "MOTORISTA");
    expect(minhas.status).toBe(200);
    expect(minhas.json).toEqual(
      expect.objectContaining({
        data: [expect.objectContaining({ id: ordemId, motoristaId })],
      }),
    );
    expect((await request("GET", "/indicadores", undefined, "MOTORISTA")).status).toBe(403);
    const saida = await request(
      "PATCH",
      `/ordens-coleta/${ordemId}/etapa`,
      { status: "EM_DESLOCAMENTO" },
      "MOTORISTA",
    );
    expect(saida.status).toBe(200);
    expect(saida.json).toMatchObject({ status: "EM_DESLOCAMENTO" });
    expect(
      (
        await request(
          "PATCH",
          `/ordens-coleta/${ordemId}/etapa`,
          { status: "NO_LOCAL" },
          "MOTORISTA",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "PATCH",
          `/ordens-coleta/${ordemId}/etapa`,
          { status: "ENTREGUE_SVO" },
          "MOTORISTA",
        )
      ).json,
    ).toMatchObject({ status: "ENTREGUE_SVO" });
  });
});
