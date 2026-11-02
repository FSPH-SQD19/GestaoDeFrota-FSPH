import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../src/middleware/http_m";

const mocks = vi.hoisted(() => ({
  usuarioFindMany: vi.fn(),
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
    usuario: { findMany: mocks.usuarioFindMany },
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

import {
  listarNotificacoes,
  listarNotificacoesQuerySchema,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
  notificarSolicitacaoAprovada,
  notificarSolicitacaoRecusada,
  notificarSolicitacaoUrgente,
  notificarViaturaSvoLiberada,
  sincronizarAlertasVencimento,
} from "../../../src/service/notificacao_s";

const gestorId = "00000000-0000-4000-8000-000000000001";
const adminId = "00000000-0000-4000-8000-000000000002";
const solicitanteId = "00000000-0000-4000-8000-000000000003";
const motoristaUsuarioId = "00000000-0000-4000-8000-000000000004";
const swoUsuarioId = "00000000-0000-4000-8000-000000000005";
const notificacaoId = "00000000-0000-4000-8000-0000000000a1";

describe("notificacao_s — central de notificações e alertas operacionais", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notificacaoCreateMany.mockResolvedValue({ count: 0 });
    mocks.motoristaFindMany.mockResolvedValue([]);
    mocks.motoristaFindFirst.mockResolvedValue(null);
    mocks.veiculoFindMany.mockResolvedValue([]);
  });

  it("valida os parâmetros da query de listagem", () => {
    expect(listarNotificacoesQuerySchema.parse({})).toEqual({
      apenasNaoLidas: false,
      limit: 20,
    });
    expect(listarNotificacoesQuerySchema.parse({ apenasNaoLidas: "true", limit: "15" })).toEqual({
      apenasNaoLidas: true,
      limit: 15,
    });
    expect(() => listarNotificacoesQuerySchema.parse({ apenasNaoLidas: "invalido" })).toThrow();
    expect(() => listarNotificacoesQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => listarNotificacoesQuerySchema.parse({ limit: "51" })).toThrow();
  });

  it("sincroniza alertas de 30 dias para GESTOR ignorando documentos históricos já renovados", async () => {
    const referencia = new Date("2026-11-02T12:00:00.000Z");

    mocks.motoristaFindMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-0000000000b1",
        numeroCnh: "12345678901",
        validadeCnh: new Date("2026-11-20T00:00:00.000Z"),
        usuario: { nome: "Carlos Condutor" },
      },
    ]);

    mocks.veiculoFindMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-0000000000c1",
        placa: "QWE1D23",
        modelo: "Fiat Toro",
        documentos: [
          // CRLV antigo vencido, porém já renovado para 2027 -> NÃO deve alertar
          {
            id: "00000000-0000-4000-8000-0000000000d1",
            tipoDocumento: "CRLV",
            dataVencimento: new Date("2026-10-10T00:00:00.000Z"),
          },
          {
            id: "00000000-0000-4000-8000-0000000000d2",
            tipoDocumento: "CRLV",
            dataVencimento: new Date("2027-10-10T00:00:00.000Z"),
          },
          // SEGURO atual vencendo em 10 dias -> DEVE alertar
          {
            id: "00000000-0000-4000-8000-0000000000d3",
            tipoDocumento: "SEGURO",
            dataVencimento: new Date("2026-11-12T00:00:00.000Z"),
          },
        ],
      },
    ]);

    await sincronizarAlertasVencimento({ id: gestorId, perfis: ["GESTOR"] }, referencia);

    expect(mocks.notificacaoCreateMany).toHaveBeenCalledOnce();
    const chamada = mocks.notificacaoCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ tipo: string; titulo: string; chaveUnica: string }>;
      skipDuplicates: boolean;
    };
    expect(chamada.skipDuplicates).toBe(true);
    expect(chamada.data).toHaveLength(2);
    expect(chamada.data.map((d) => d.tipo)).toEqual(["CNH_VENCENDO", "DOCUMENTO_VEICULO_VENCENDO"]);
    expect(chamada.data[1]?.titulo).toContain("SEGURO");
    expect(chamada.data[1]?.chaveUnica).toBe(
      `doc-30d:00000000-0000-4000-8000-0000000000d3:2026-11-12:${gestorId}`,
    );
  });

  it("sincroniza alerta da própria CNH para usuário MOTORISTA", async () => {
    const referencia = new Date("2026-11-02T12:00:00.000Z");
    mocks.motoristaFindFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000b2",
      numeroCnh: "99988877766",
      validadeCnh: new Date("2026-10-30T00:00:00.000Z"),
      usuario: { nome: "Pedro Motorista" },
    });

    await sincronizarAlertasVencimento(
      { id: motoristaUsuarioId, perfis: ["MOTORISTA"] },
      referencia,
    );

    expect(mocks.notificacaoCreateMany).toHaveBeenCalledOnce();
    const criada = mocks.notificacaoCreateMany.mock.calls[0]?.[0]?.data[0];
    expect(criada.usuarioId).toBe(motoristaUsuarioId);
    expect(criada.tipo).toBe("CNH_VENCENDO");
    expect(criada.titulo).toContain("CNH vencida");
  });

  it("notifica ADMIN e GESTOR ao criar solicitação urgente", async () => {
    mocks.usuarioFindMany.mockResolvedValue([{ id: gestorId }, { id: adminId }]);

    await notificarSolicitacaoUrgente({
      id: "00000000-0000-4000-8000-0000000000e1",
      protocolo: "SV-2026-0099",
      setorOrigem: "LACEN",
      destino: "HEMOSE",
    });

    expect(mocks.notificacaoCreateMany).toHaveBeenCalledOnce();
    const lote = mocks.notificacaoCreateMany.mock.calls[0]?.[0]?.data;
    expect(lote).toHaveLength(2);
    expect(lote[0]).toMatchObject({
      usuarioId: gestorId,
      tipo: "SOLICITACAO_URGENTE",
      titulo: "Solicitação urgente SV-2026-0099",
    });
  });

  it("notifica solicitante e motorista na aprovação e trunca recusa longa", async () => {
    await notificarSolicitacaoAprovada({
      id: "00000000-0000-4000-8000-0000000000e2",
      protocolo: "SV-2026-0100",
      destino: "Hospital Regional",
      solicitanteId,
      veiculoPlaca: "ABC1D23",
      motoristaUsuarioId,
    });

    const aprovadas = mocks.notificacaoCreateMany.mock.calls[0]?.[0]?.data;
    expect(aprovadas).toHaveLength(2);
    expect(aprovadas[0]?.usuarioId).toBe(solicitanteId);
    expect(aprovadas[1]?.usuarioId).toBe(motoristaUsuarioId);

    await notificarSolicitacaoRecusada({
      id: "00000000-0000-4000-8000-0000000000e3",
      protocolo: "SV-2026-0101",
      solicitanteId,
      motivoRecusa: "Indisponibilidade operacional. ".repeat(30),
    });

    const recusadas = mocks.notificacaoCreateMany.mock.calls[1]?.[0]?.data;
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0]?.tipo).toBe("VIAGEM_RECUSADA");
    expect(recusadas[0]?.mensagem.length).toBeLessThanOrEqual(500);
  });

  it("notifica equipes SVO, GESTOR e ADMIN quando viatura SVO conclui desinfecção", async () => {
    mocks.usuarioFindMany.mockResolvedValue([{ id: swoUsuarioId }, { id: gestorId }]);

    await notificarViaturaSvoLiberada({
      veiculoId: "00000000-0000-4000-8000-0000000000f1",
      placa: "SVO9A88",
      modelo: "Fiat Fiorino SVO",
      referenciaDesinfeccao: "2026-11-02T12:30:00.000Z",
    });

    const lote = mocks.notificacaoCreateMany.mock.calls[0]?.[0]?.data;
    expect(lote).toHaveLength(2);
    expect(lote[0]?.tipo).toBe("SVO_DESINFECCAO_CONCLUIDA");
    expect(lote[0]?.titulo).toContain("SVO9A88");
  });

  it("lista notificações, marca individual validando posse e marca todas como lidas", async () => {
    const agora = new Date("2026-11-02T12:00:00.000Z");
    const registroBanco = {
      id: notificacaoId,
      usuarioId: solicitanteId,
      tipo: "VIAGEM_APROVADA",
      titulo: "Viagem SV-2026-0100 aprovada",
      mensagem: "Sua solicitação foi aprovada.",
      referenciaTipo: "SOLICITACAO_VIAGEM",
      referenciaId: "00000000-0000-4000-8000-0000000000e2",
      chaveUnica: "aprov-sol:1",
      lida: false,
      lidaEm: null,
      criadoEm: agora,
    };

    mocks.notificacaoFindMany.mockResolvedValue([registroBanco]);
    mocks.notificacaoCount.mockResolvedValue(1);

    const lista = await listarNotificacoes(
      { id: solicitanteId, perfis: ["SOLICITANTE"] },
      { apenasNaoLidas: false, limit: 20 },
      agora,
    );
    expect(lista.meta).toEqual({ naoLidas: 1, retornadas: 1 });
    expect(lista.data[0]?.id).toBe(notificacaoId);

    await expect(marcarNotificacaoComoLida("id-invalido", solicitanteId)).rejects.toMatchObject({
      statusCode: 400,
    } satisfies Partial<HttpError>);

    mocks.notificacaoFindFirst.mockResolvedValueOnce(null);
    await expect(marcarNotificacaoComoLida(notificacaoId, gestorId)).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<HttpError>);

    mocks.notificacaoFindFirst.mockResolvedValueOnce(registroBanco);
    mocks.notificacaoUpdate.mockResolvedValueOnce({
      ...registroBanco,
      lida: true,
      lidaEm: agora,
    });

    const marcada = await marcarNotificacaoComoLida(notificacaoId, solicitanteId);
    expect(marcada.lida).toBe(true);
    expect(marcada.lidaEm).toBe(agora.toISOString());

    mocks.notificacaoUpdateMany.mockResolvedValueOnce({ count: 3 });
    const emLote = await marcarTodasNotificacoesComoLidas(solicitanteId);
    expect(emLote).toEqual({ atualizadas: 3, naoLidas: 0 });
  });
});
