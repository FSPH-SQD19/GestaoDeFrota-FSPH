import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    auditoriaSistema: {
      create: mocks.create,
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

import {
  registrarAuditoria,
  sanitizarLgpd,
  listarAuditoriaSchema,
  listarAuditoria,
} from "../../../src/service/auditoria_s";

describe("auditoria service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("registra campos opcionais como nulos quando nao informados", async () => {
    const input = { acao: "CRIAR", tabelaAfetada: "veiculos", dadosNovos: { placa: "ABC1D23" } };
    const saved = { id: "auditoria-teste" };
    mocks.create.mockResolvedValue(saved);

    await expect(registrarAuditoria(input)).resolves.toBe(saved);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { ...input, usuarioId: null, registroId: null },
    });
  });

  it("preserva os identificadores e dados informados", async () => {
    const input = {
      usuarioId: "usuario-teste",
      registroId: "veiculo-teste",
      acao: "ATUALIZAR",
      tabelaAfetada: "veiculos",
      dadosNovos: { ativo: false },
    };
    await registrarAuditoria(input);

    expect(mocks.create).toHaveBeenCalledWith({ data: input });
  });
});

describe("sanitizarLgpd", () => {
  it("mascara campos sensíveis como senha e token mantendo os demais intactos", () => {
    const entrada = {
      nome: "Carlos Silva",
      email: "carlos@fsph.se.gov.br",
      senhaHash: "$2a$10$abcdef...",
      token: "jwt-token-secreto",
      dados: {
        novaSenha: "NovaSenha@123",
        cargo: "Motorista",
      },
    };

    const resultado = sanitizarLgpd(entrada) as Record<string, unknown>;

    expect(resultado.nome).toBe("Carlos Silva");
    expect(resultado.email).toBe("carlos@fsph.se.gov.br");
    expect(resultado.senhaHash).toBe("******");
    expect(resultado.token).toBe("******");
    expect((resultado.dados as Record<string, unknown>).novaSenha).toBe("******");
    expect((resultado.dados as Record<string, unknown>).cargo).toBe("Motorista");
  });
});

describe("listarAuditoriaSchema", () => {
  it("aplica padrões de paginação e sanitiza filtros vazios", () => {
    const parsed = listarAuditoriaSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.tabelaAfetada).toBeUndefined();
    expect(parsed.acao).toBeUndefined();
  });

  it("converte valores 'TODAS' e 'TODOS' para undefined", () => {
    const parsed = listarAuditoriaSchema.parse({
      tabelaAfetada: "TODAS",
      acao: "TODAS",
      usuarioId: "TODOS",
    });
    expect(parsed.tabelaAfetada).toBeUndefined();
    expect(parsed.acao).toBeUndefined();
    expect(parsed.usuarioId).toBeUndefined();
  });

  it("converte dataInicio e dataFim em objetos Date", () => {
    const parsed = listarAuditoriaSchema.parse({
      dataInicio: "2026-11-01",
      dataFim: "2026-11-10",
    });
    expect(parsed.dataInicio).toBeInstanceOf(Date);
    expect(parsed.dataFim).toBeInstanceOf(Date);
  });
});

describe("listarAuditoria", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retorna lista de logs paginada e sanitizada", async () => {
    const mockLogs = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        usuarioId: "00000000-0000-4000-8000-000000000002",
        acao: "CRIAR",
        tabelaAfetada: "solicitacoes_viagem",
        registroId: "00000000-0000-4000-8000-000000000003",
        dadosNovos: { protocolo: "SV-2026-0001", destino: "Hospital Regional" },
        criadoEm: new Date("2026-11-10T10:00:00Z"),
        usuario: {
          id: "00000000-0000-4000-8000-000000000002",
          nome: "Admin Teste",
          email: "admin@fsph.se.gov.br",
          setor: "Tecnologia",
        },
      },
    ];

    mocks.findMany.mockResolvedValue(mockLogs);
    mocks.count.mockResolvedValue(1);

    const resultado = await listarAuditoria({
      page: 1,
      pageSize: 20,
    });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0].acao).toBe("CRIAR");
    expect(resultado.data[0].usuario?.nome).toBe("Admin Teste");
    expect(resultado.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("aplica filtros de busca, ação e tabela no banco", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await listarAuditoria({
      page: 2,
      pageSize: 10,
      tabelaAfetada: "veiculos",
      acao: "ATUALIZAR",
      busca: "Spin",
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tabelaAfetada: "veiculos",
          acao: "ATUALIZAR",
          OR: expect.arrayContaining([
            { acao: { contains: "Spin", mode: "insensitive" } },
            { tabelaAfetada: { contains: "Spin", mode: "insensitive" } },
          ]),
        }),
        skip: 10,
        take: 10,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      }),
    );
  });
});
