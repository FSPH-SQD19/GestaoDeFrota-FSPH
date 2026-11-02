import { getAuthConfig } from "../../../src/config/auth";
vi.mock("../../../src/config/auth", () => ({ getAuthConfig: vi.fn() }));
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { signTestToken } from "../../helpers/auth";
vi.mock("../../../src/service/session_s", async () => {
  const { resolveTestSession } = await import("../../helpers/auth");
  return { resolveSession: resolveTestSession };
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  motoristaFindMany: vi.fn(),
  motoristaFindFirst: vi.fn(),
  veiculoFindMany: vi.fn(),
  notificacaoCreateMany: vi.fn(),
  notificacaoFindMany: vi.fn(),
  notificacaoCount: vi.fn(),
  notificacaoFindFirst: vi.fn(),
  notificacaoUpdate: vi.fn(),
  notificacaoUpdateMany: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    motorista: {
      findMany: mocks.motoristaFindMany,
      findFirst: mocks.motoristaFindFirst,
    },
    veiculo: { findMany: mocks.veiculoFindMany },
    notificacao: {
      createMany: mocks.notificacaoCreateMany,
      findMany: mocks.notificacaoFindMany,
      count: mocks.notificacaoCount,
      findFirst: mocks.notificacaoFindFirst,
      update: mocks.notificacaoUpdate,
      updateMany: mocks.notificacaoUpdateMany,
    },
  },
}));

import { app } from "../../../src/app";

const secret = "chave-sintetica-dos-testes-de-notificacoes";
const usuarioId = "00000000-0000-4000-8000-000000000001";
const notificacaoId = "00000000-0000-4000-8000-0000000000n1";
const realN1 = "00000000-0000-4000-8000-0000000000a1";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAuthConfig).mockReturnValue({ secret, expiresIn: 28800 });
  mocks.motoristaFindMany.mockResolvedValue([]);
  mocks.motoristaFindFirst.mockResolvedValue(null);
  mocks.veiculoFindMany.mockResolvedValue([]);
  mocks.notificacaoCreateMany.mockResolvedValue({ count: 0 });
  mocks.notificacaoFindMany.mockResolvedValue([
    {
      id: realN1,
      usuarioId,
      tipo: "SOLICITACAO_URGENTE",
      titulo: "Solicitação urgente SV-2026-0008",
      mensagem: "Nova solicitação urgente do setor LACEN.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: "00000000-0000-4000-8000-0000000000b1",
      chaveUnica: "urg:1",
      lida: false,
      lidaEm: null,
      criadoEm: new Date("2026-11-02T11:00:00.000Z"),
    },
  ]);
  mocks.notificacaoCount.mockResolvedValue(1);
});

async function chamar(
  caminho: string,
  { metodo = "GET", perfis = ["GESTOR"] }: { metodo?: string; perfis?: string[] | null } = {},
) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers: {
      ...(perfis && {
        authorization: `Bearer ${signTestToken({ perfis }, secret, { subject: usuarioId })}`,
      }),
    },
  });
  return {
    status: resposta.status,
    json: (await resposta.json()) as Record<string, unknown>,
  };
}

describe("Rotas de notificações (/api/v1/notificacoes e /notificacoes)", () => {
  it("exige autenticação em todas as rotas de notificações", async () => {
    const getSemAuth = await chamar("/api/v1/notificacoes", { perfis: null });
    expect(getSemAuth.status).toBe(401);

    const patchSemAuth = await chamar(`/api/v1/notificacoes/${realN1}/lida`, {
      metodo: "PATCH",
      perfis: null,
    });
    expect(patchSemAuth.status).toBe(401);
  });

  it("lista notificações e contador de não lidas em /api/v1/notificacoes e no alias /notificacoes", async () => {
    const respostaV1 = await chamar("/api/v1/notificacoes?apenasNaoLidas=true&limit=10");
    expect(respostaV1.status).toBe(200);
    expect(respostaV1.json.meta).toEqual({ naoLidas: 1, retornadas: 1 });
    expect(Array.isArray(respostaV1.json.data)).toBe(true);

    const respostaAlias = await chamar("/notificacoes");
    expect(respostaAlias.status).toBe(200);
  });

  it("rejeita filtros inválidos na listagem com status 400", async () => {
    const invalida = await chamar("/api/v1/notificacoes?limit=999");
    expect(invalida.status).toBe(400);
  });

  it("marca notificação individual como lida e retorna 400/404 em entradas inválidas ou alheias", async () => {
    const idInvalido = await chamar(`/api/v1/notificacoes/${notificacaoId}/lida`, {
      metodo: "PATCH",
    });
    expect(idInvalido.status).toBe(400);

    mocks.notificacaoFindFirst.mockResolvedValueOnce(null);
    const alheia = await chamar(`/api/v1/notificacoes/${realN1}/lida`, { metodo: "PATCH" });
    expect(alheia.status).toBe(404);

    const agora = new Date("2026-11-02T12:15:00.000Z");
    mocks.notificacaoFindFirst.mockResolvedValueOnce({
      id: realN1,
      usuarioId,
      tipo: "SOLICITACAO_URGENTE",
      titulo: "Solicitação urgente SV-2026-0008",
      mensagem: "Nova solicitação urgente do setor LACEN.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: null,
      chaveUnica: null,
      lida: false,
      lidaEm: null,
      criadoEm: agora,
    });
    mocks.notificacaoUpdate.mockResolvedValueOnce({
      id: realN1,
      usuarioId,
      tipo: "SOLICITACAO_URGENTE",
      titulo: "Solicitação urgente SV-2026-0008",
      mensagem: "Nova solicitação urgente do setor LACEN.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: null,
      chaveUnica: null,
      lida: true,
      lidaEm: agora,
      criadoEm: agora,
    });

    const sucesso = await chamar(`/api/v1/notificacoes/${realN1}/lida`, { metodo: "PATCH" });
    expect(sucesso.status).toBe(200);
    expect(sucesso.json.lida).toBe(true);
  });

  it("marca todas as notificações do usuário como lidas em PATCH /api/v1/notificacoes/ler-todas", async () => {
    mocks.notificacaoUpdateMany.mockResolvedValueOnce({ count: 4 });

    const resposta = await chamar("/api/v1/notificacoes/ler-todas", { metodo: "PATCH" });
    expect(resposta.status).toBe(200);
    expect(resposta.json).toEqual({ atualizadas: 4, naoLidas: 0 });
  });
});
