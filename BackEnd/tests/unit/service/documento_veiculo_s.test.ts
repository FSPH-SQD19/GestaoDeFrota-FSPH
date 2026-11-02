import type { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  veiculoFindUnique: vi.fn(),
  documentoFindMany: vi.fn(),
  documentoFindFirst: vi.fn(),
  documentoCreate: vi.fn(),
  registrarAuditoria: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    veiculo: { findUnique: mocks.veiculoFindUnique },
    documentoVeiculo: {
      findMany: mocks.documentoFindMany,
      findFirst: mocks.documentoFindFirst,
      create: mocks.documentoCreate,
    },
  },
}));
vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

import { HttpError } from "../../../src/middleware/http_m";
import { validar } from "../../../src/controller/veiculo_c";
import {
  calcularSituacao,
  criarDocumentoVeiculo,
  criarDocumentoVeiculoSchema,
  dataLocal,
  documentosAtuais,
  exigirDocumentosEmDia,
  listarDocumentosVeiculo,
} from "../../../src/service/documento_veiculo_s";

const usuarioId = "00000000-0000-4000-8000-000000000001";
const veiculoId = "00000000-0000-4000-8000-0000000000a1";
const HOJE = "2026-10-31";

function data(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function documento(id: string, tipoDocumento: string | null, vencimento: string) {
  return { id, veiculoId, tipoDocumento, dataVencimento: data(vencimento), status: "VIGENTE" };
}

async function erroDe(promessa: Promise<unknown>): Promise<HttpError> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof HttpError) return erro;
    throw erro;
  }
  throw new Error("Era esperado um HttpError.");
}

function txCom(documentos: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(documentos);
  return {
    findMany,
    tx: { documentoVeiculo: { findMany } } as unknown as Prisma.TransactionClient,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T12:00:00-03:00"));
  mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: true });
  mocks.documentoFindMany.mockResolvedValue([]);
  mocks.documentoFindFirst.mockResolvedValue(null);
  mocks.registrarAuditoria.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("datas e situação", () => {
  it("usa o dia local de America/Sao_Paulo", () => {
    expect(dataLocal()).toBe(HOJE);
    expect(dataLocal(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
    expect(dataLocal(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
  });

  it.each([
    ["2026-10-30", "VENCIDO"],
    ["2026-10-31", "PROXIMO_VENCIMENTO"],
    ["2027-01-29", "PROXIMO_VENCIMENTO"],
    ["2027-01-30", "VIGENTE"],
    ["2028-01-01", "VIGENTE"],
  ])("vencimento em %s é %s", (vencimento, situacao) => {
    expect(calcularSituacao(vencimento, HOJE)).toBe(situacao);
  });

  it("considera, por tipo, o documento de maior vencimento e ignora registros sem tipo", () => {
    const atuais = documentosAtuais([
      documento("1", "CRLV", "2025-12-31"),
      documento("2", "CRLV", "2026-12-31"),
      documento("3", "SEGURO", "2026-05-01"),
      documento("4", null, "2020-01-01"),
    ]);

    expect([...atuais.keys()].sort()).toEqual(["CRLV", "SEGURO"]);
    expect(atuais.get("CRLV")?.id).toBe("2");
  });
});

describe("criarDocumentoVeiculoSchema", () => {
  it("aceita o corpo mínimo e descarta campos extras", () => {
    expect(
      validar(criarDocumentoVeiculoSchema, {
        tipoDocumento: "CRLV",
        dataVencimento: "2027-03-31",
        status: "VIGENTE",
        veiculoId: "outro",
      }),
    ).toEqual({ tipoDocumento: "CRLV", dataVencimento: "2027-03-31" });
  });

  it.each([
    [{}, ["tipoDocumento", "dataVencimento"]],
    [{ tipoDocumento: "CNH", dataVencimento: "2027-03-31" }, ["tipoDocumento"]],
    [{ tipoDocumento: "IPVA", dataVencimento: "2027-02-30" }, ["dataVencimento"]],
    [{ tipoDocumento: "IPVA", dataVencimento: "31/03/2027" }, ["dataVencimento"]],
    [{ tipoDocumento: "IPVA", dataVencimento: "2027-03-31T10:00:00Z" }, ["dataVencimento"]],
    [{ tipoDocumento: "SEGURO", dataVencimento: "1999-12-31" }, ["dataVencimento"]],
    [{ tipoDocumento: "SEGURO", dataVencimento: null }, ["dataVencimento"]],
  ])("rejeita %j", (corpo, campos) => {
    const erro = (() => {
      try {
        validar(criarDocumentoVeiculoSchema, corpo);
      } catch (e) {
        return e as HttpError;
      }
      throw new Error("Era esperado erro de validação.");
    })();

    expect(erro.statusCode).toBe(400);
    expect(erro.errors.map((item) => item.campo).sort()).toEqual([...campos].sort());
  });
});

describe("listarDocumentosVeiculo", () => {
  it("retorna 400 para id inválido sem consultar o banco", async () => {
    const erro = await erroDe(listarDocumentosVeiculo("abc"));

    expect(erro.statusCode).toBe(400);
    expect(mocks.veiculoFindUnique).not.toHaveBeenCalled();
  });

  it("retorna 404 para veículo inexistente", async () => {
    mocks.veiculoFindUnique.mockResolvedValue(null);

    expect((await erroDe(listarDocumentosVeiculo(veiculoId))).statusCode).toBe(404);
    expect(mocks.documentoFindMany).not.toHaveBeenCalled();
  });

  it("retorna lista vazia com todos os tipos sem registro", async () => {
    expect(await listarDocumentosVeiculo(veiculoId)).toEqual({
      data: [],
      resumo: {
        situacaoGeral: null,
        bloqueiaAlocacao: false,
        tiposSemRegistro: ["CRLV", "IPVA", "SEGURO"],
      },
    });
  });

  it("calcula situação, dias e o documento atual de cada tipo", async () => {
    mocks.documentoFindMany.mockResolvedValue([
      documento("a", "CRLV", "2027-06-30"),
      documento("b", "SEGURO", "2026-11-15"),
      documento("c", "CRLV", "2026-06-30"),
    ]);

    const resultado = await listarDocumentosVeiculo(veiculoId);

    expect(mocks.documentoFindMany).toHaveBeenCalledWith({
      where: { veiculoId },
      orderBy: [{ dataVencimento: "desc" }, { id: "asc" }],
    });
    expect(resultado.data).toEqual([
      {
        id: "a",
        veiculoId,
        tipoDocumento: "CRLV",
        dataVencimento: "2027-06-30",
        situacao: "VIGENTE",
        diasParaVencer: 242,
        atual: true,
      },
      {
        id: "b",
        veiculoId,
        tipoDocumento: "SEGURO",
        dataVencimento: "2026-11-15",
        situacao: "PROXIMO_VENCIMENTO",
        diasParaVencer: 15,
        atual: true,
      },
      {
        id: "c",
        veiculoId,
        tipoDocumento: "CRLV",
        dataVencimento: "2026-06-30",
        situacao: "VENCIDO",
        diasParaVencer: -123,
        atual: false,
      },
    ]);
    expect(resultado.resumo).toEqual({
      situacaoGeral: "PROXIMO_VENCIMENTO",
      bloqueiaAlocacao: false,
      tiposSemRegistro: ["IPVA"],
    });
  });

  it("indica bloqueio quando o documento atual de algum tipo está vencido", async () => {
    mocks.documentoFindMany.mockResolvedValue([
      documento("a", "SEGURO", "2027-06-30"),
      documento("b", "IPVA", "2026-10-30"),
    ]);

    expect((await listarDocumentosVeiculo(veiculoId)).resumo).toMatchObject({
      situacaoGeral: "VENCIDO",
      bloqueiaAlocacao: true,
    });
  });
});

describe("criarDocumentoVeiculo", () => {
  const entrada = { tipoDocumento: "CRLV" as const, dataVencimento: "2026-12-31" };

  beforeEach(() => {
    mocks.documentoCreate.mockImplementation(({ data: dados }) =>
      Promise.resolve({ id: "novo", ...dados }),
    );
  });

  it("cadastra, grava a situação do momento e audita sem bloquear", async () => {
    const resposta = await criarDocumentoVeiculo(veiculoId, entrada, usuarioId);

    expect(mocks.documentoCreate).toHaveBeenCalledWith({
      data: {
        veiculoId,
        tipoDocumento: "CRLV",
        dataVencimento: data("2026-12-31"),
        status: "PROXIMO_VENCIMENTO",
      },
    });
    expect(resposta).toEqual({
      id: "novo",
      veiculoId,
      tipoDocumento: "CRLV",
      dataVencimento: "2026-12-31",
      situacao: "PROXIMO_VENCIMENTO",
      diasParaVencer: 61,
      atual: true,
    });
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith({
      usuarioId,
      acao: "CRIAR",
      tabelaAfetada: "documentos_veiculo",
      registroId: "novo",
      dadosNovos: { veiculoId, tipoDocumento: "CRLV", dataVencimento: "2026-12-31" },
    });
  });

  it("marca como não atual quando já existe vencimento posterior do mesmo tipo", async () => {
    mocks.documentoFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "outro" });

    expect((await criarDocumentoVeiculo(veiculoId, entrada, usuarioId)).atual).toBe(false);
  });

  it("aceita cadastrar documento já vencido", async () => {
    const resposta = await criarDocumentoVeiculo(
      veiculoId,
      { tipoDocumento: "IPVA", dataVencimento: "2026-01-31" },
      usuarioId,
    );

    expect(resposta.situacao).toBe("VENCIDO");
  });

  it("não converte falha da auditoria em erro", async () => {
    const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.registrarAuditoria.mockRejectedValue(new Error("falhou"));

    expect((await criarDocumentoVeiculo(veiculoId, entrada, usuarioId)).id).toBe("novo");
    expect(erroConsole).toHaveBeenCalled();
  });

  it.each([
    ["id inválido", "abc", null, 400],
    ["veículo inexistente", veiculoId, null, 404],
    ["veículo inativo", veiculoId, { id: veiculoId, ativo: false }, 422],
  ])("rejeita %s", async (_caso, id, veiculo, status) => {
    mocks.veiculoFindUnique.mockResolvedValue(veiculo);

    expect((await erroDe(criarDocumentoVeiculo(id, entrada, usuarioId))).statusCode).toBe(status);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });

  it("retorna 409 para o mesmo tipo com o mesmo vencimento", async () => {
    mocks.documentoFindFirst.mockResolvedValue({ id: "existente" });

    const erro = await erroDe(criarDocumentoVeiculo(veiculoId, entrada, usuarioId));

    expect(erro.statusCode).toBe(409);
    expect(erro.errors).toEqual([
      { campo: "dataVencimento", mensagem: "Já existe este tipo com o mesmo vencimento." },
    ]);
    expect(mocks.documentoCreate).not.toHaveBeenCalled();
  });
});

describe("exigirDocumentosEmDia", () => {
  it("permite veículo sem documentos cadastrados", async () => {
    const { tx, findMany } = txCom([]);

    await expect(exigirDocumentosEmDia(tx, veiculoId, "2026-11-10")).resolves.toBeUndefined();
    expect(findMany).toHaveBeenCalledWith({
      where: { veiculoId, tipoDocumento: { in: ["CRLV", "IPVA", "SEGURO"] } },
      select: { tipoDocumento: true, dataVencimento: true },
    });
  });

  it("bloqueia documento já vencido", async () => {
    const { tx } = txCom([documento("a", "CRLV", "2026-10-30")]);

    const erro = await erroDe(exigirDocumentosEmDia(tx, veiculoId, "2026-11-10"));

    expect(erro.statusCode).toBe(422);
    expect(erro.message).toBe("Documentação do veículo vencida durante o período da viagem.");
    expect(erro.errors).toEqual([{ campo: "veiculoId", mensagem: "CRLV vencido em 30/10/2026." }]);
  });

  it("bloqueia documento que vence antes do retorno da viagem", async () => {
    const { tx } = txCom([documento("a", "SEGURO", "2026-11-09")]);

    expect((await erroDe(exigirDocumentosEmDia(tx, veiculoId, "2026-11-10"))).errors).toEqual([
      { campo: "veiculoId", mensagem: "SEGURO vence em 09/11/2026, antes do retorno da viagem." },
    ]);
  });

  it("permite documento que vence no próprio dia do retorno", async () => {
    const { tx } = txCom([documento("a", "IPVA", "2026-11-10")]);

    await expect(exigirDocumentosEmDia(tx, veiculoId, "2026-11-10")).resolves.toBeUndefined();
  });

  it("usa hoje como referência quando o retorno já passou", async () => {
    const { tx } = txCom([documento("a", "IPVA", "2026-10-20")]);

    expect((await erroDe(exigirDocumentosEmDia(tx, veiculoId, "2026-10-01"))).statusCode).toBe(422);
  });

  it("considera só o documento mais recente de cada tipo e lista todos os pendentes", async () => {
    const { tx } = txCom([
      documento("a", "CRLV", "2025-10-31"),
      documento("b", "CRLV", "2027-10-31"),
      documento("c", "SEGURO", "2026-10-01"),
      documento("d", "IPVA", "2026-09-01"),
    ]);

    expect((await erroDe(exigirDocumentosEmDia(tx, veiculoId, "2026-11-10"))).errors).toEqual([
      { campo: "veiculoId", mensagem: "IPVA vencido em 01/09/2026." },
      { campo: "veiculoId", mensagem: "SEGURO vencido em 01/10/2026." },
    ]);
  });
});
