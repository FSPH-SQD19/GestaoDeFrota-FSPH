import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../../../src/services/api", () => ({
  api: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
  },
}));

vi.mock("../../../src/services/notificacoesService", () => ({
  dispararAtualizacaoNotificacoes: vi.fn(),
}));

import { obterChamadosSvo, obterEscalasEmAndamentoSvo } from "../../../src/services/svo";

const CHAMADO_VALIDO = {
  id: "chamado-1",
  numeroProtocolo: "SVO-2026-0001",
  atendenteId: null,
  nomeFalecido: "João da Silva",
  enderecoOcorrencia: "Rua das Flores, 10",
  relatoOcorrencia: "Ocorrência domiciliar.",
  statusTriagem: "EM_ANALISE",
  justificativaTriagem: null,
  atendente: null,
  ordemColeta: null,
};

const META_VALIDA = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

const ESCALA_VALIDA = {
  id: "escala-1",
  motorista: {
    id: "motorista-1",
    nome: "Maria Souza",
    telefone: null,
    ativo: true,
  },
  veiculo: {
    id: "veiculo-1",
    placa: "ABC1D23",
    modelo: "S10",
    status: "DISPONIVEL",
    ativo: true,
  },
  inicioTurno: "2026-11-03T07:00:00-03:00",
  fimTurno: "2026-11-03T19:00:00-03:00",
  observacoes: null,
  encerradaEm: null,
  situacao: "EM_ANDAMENTO",
};

describe("serviço SVO - validação das respostas da API", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("retorna chamados e metadados quando a resposta está no formato esperado", async () => {
    const resposta = { data: [CHAMADO_VALIDO], meta: META_VALIDA };
    mocks.get.mockResolvedValue({ data: resposta });

    await expect(obterChamadosSvo()).resolves.toEqual(resposta);
  });

  it.each([
    ["sem a lista de dados", { meta: META_VALIDA }],
    ["com data que não é uma lista", { data: {}, meta: META_VALIDA }],
    ["sem metadados", { data: [CHAMADO_VALIDO] }],
    ["sem totalPages", { data: [CHAMADO_VALIDO], meta: { page: 1, pageSize: 10, total: 1 } }],
    [
      "com totalPages inválido",
      { data: [CHAMADO_VALIDO], meta: { ...META_VALIDA, totalPages: "um" } },
    ],
    ["com um chamado incompleto", { data: [{ id: "chamado-incompleto" }], meta: META_VALIDA }],
  ])("rejeita resposta de chamados %s com erro explícito", async (_caso, resposta) => {
    mocks.get.mockResolvedValue({ data: resposta });

    await expect(obterChamadosSvo()).rejects.toThrow(
      "Resposta inesperada da API do SVO (chamados)",
    );
  });

  it("retorna escalas quando os registros e a paginação são válidos", async () => {
    mocks.get.mockResolvedValue({
      data: { data: [ESCALA_VALIDA], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
    });

    await expect(obterEscalasEmAndamentoSvo()).resolves.toEqual([ESCALA_VALIDA]);
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/svo/escalas", {
      params: { situacao: "EM_ANDAMENTO", page: 1, pageSize: 100 },
    });
  });

  it("consulta todas as páginas e remove escalas repetidas entre páginas", async () => {
    const segundaEscala = {
      ...ESCALA_VALIDA,
      id: "escala-2",
      veiculo: { ...ESCALA_VALIDA.veiculo, id: "veiculo-2" },
    };
    mocks.get
      .mockResolvedValueOnce({
        data: {
          data: [ESCALA_VALIDA],
          meta: { page: 1, pageSize: 100, total: 201, totalPages: 3 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [segundaEscala],
          meta: { page: 2, pageSize: 100, total: 201, totalPages: 3 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [ESCALA_VALIDA],
          meta: { page: 3, pageSize: 100, total: 201, totalPages: 3 },
        },
      });

    await expect(obterEscalasEmAndamentoSvo()).resolves.toEqual([ESCALA_VALIDA, segundaEscala]);
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(mocks.get).toHaveBeenNthCalledWith(2, "/api/v1/svo/escalas", {
      params: { situacao: "EM_ANDAMENTO", page: 2, pageSize: 100 },
    });
    expect(mocks.get).toHaveBeenNthCalledWith(3, "/api/v1/svo/escalas", {
      params: { situacao: "EM_ANDAMENTO", page: 3, pageSize: 100 },
    });
  });

  it("retorna lista vazia quando não há páginas de escalas ativas", async () => {
    mocks.get.mockResolvedValue({
      data: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } },
    });

    await expect(obterEscalasEmAndamentoSvo()).resolves.toEqual([]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("rejeita quando o servidor retorna uma página diferente da solicitada", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [ESCALA_VALIDA],
        meta: { page: 2, pageSize: 100, total: 1, totalPages: 1 },
      },
    });

    await expect(obterEscalasEmAndamentoSvo()).rejects.toThrow(
      "Resposta inesperada da API do SVO (escalas): paginação da página 1.",
    );
  });

  it.each([
    ["sem dados", { meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }],
    ["sem paginação", { data: [ESCALA_VALIDA] }],
    [
      "com horário inválido",
      {
        data: [{ ...ESCALA_VALIDA, inicioTurno: "amanhã" }],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      },
    ],
  ])("rejeita resposta de escalas %s com erro explícito", async (_caso, resposta) => {
    mocks.get.mockResolvedValue({ data: resposta });

    await expect(obterEscalasEmAndamentoSvo()).rejects.toThrow(
      "Resposta inesperada da API do SVO (escalas)",
    );
  });

  it("propaga falha ao carregar página posterior sem retornar lista parcial", async () => {
    mocks.get
      .mockResolvedValueOnce({
        data: {
          data: [ESCALA_VALIDA],
          meta: { page: 1, pageSize: 100, total: 101, totalPages: 2 },
        },
      })
      .mockRejectedValueOnce(new Error("Falha na segunda página"));

    await expect(obterEscalasEmAndamentoSvo()).rejects.toThrow("Falha na segunda página");
  });
});
