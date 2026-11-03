import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  solicitacaoViagem: { findUnique: vi.fn(), update: vi.fn() },
  motorista: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  veiculo: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  execucaoViagem: { create: vi.fn(), update: vi.fn() },
  auditoriaSistema: { create: vi.fn() },
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) },
}));
import {
  executarViagem,
  iniciarViagemSchema,
  concluirViagemSchema,
} from "../../../src/service/execucao_s";

const id = "00000000-0000-4000-8000-000000000001";
const fotoOdometro = "data:image/jpeg;base64,AAAA";
const saida = {
  kmInicial: 100,
  checklistSaida: {
    pneus: true,
    documentos: true,
    combustivel: true,
    freiosLuzes: true,
    limpeza: true,
    fotoOdometro,
  },
};
const retorno = {
  kmFinal: 120,
  checklistRetorno: {
    pneusLataria: true,
    estacionadoLocalCorreto: true,
    documentosChaveDevolvidos: true,
    limpezaInterna: true,
    semOcorrencias: true,
    fotoOdometro,
  },
};
const viagem = {
  status: "APROVADA",
  veiculoAlocadoId: id,
  motoristaAlocado: { id, ativo: true, usuarioId: id },
  execucao: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  tx.motorista.findUniqueOrThrow.mockResolvedValue({
    ativo: true,
    usuarioId: id,
    status: "DISPONIVEL",
  });
  tx.solicitacaoViagem.findUnique.mockResolvedValue(viagem);
  tx.veiculo.findUniqueOrThrow.mockResolvedValue({
    ativo: true,
    status: "DISPONIVEL",
    odometroAtual: new Prisma.Decimal(100),
  });
  tx.execucaoViagem.create.mockResolvedValue(saida);
  tx.execucaoViagem.update.mockResolvedValue(retorno);
});
function emTransito() {
  tx.motorista.findUniqueOrThrow.mockResolvedValue({
    ativo: true,
    usuarioId: id,
    status: "OCUPADO",
  });
  tx.veiculo.findUniqueOrThrow.mockResolvedValue({
    ativo: true,
    status: "EM_VIAGEM",
    odometroAtual: new Prisma.Decimal(100),
  });
  tx.solicitacaoViagem.findUnique.mockResolvedValue({
    ...viagem,
    status: "EM_TRANSITO",
    execucao: { kmInicial: new Prisma.Decimal(100), dataHoraFim: null },
  });
}
describe("execução de viagens", () => {
  it("inicia e registra checklist, horário e status", async () => {
    expect(await executarViagem(id, id, saida)).toMatchObject({ status: "EM_TRANSITO" });
    expect(tx.execucaoViagem.create).toHaveBeenCalledWith({
      data: { ...saida, solicitacaoId: id, dataHoraInicio: expect.any(Date) },
    });
    expect(tx.veiculo.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "EM_VIAGEM" },
    });
  });
  it.each([100, 120])("conclui com km final %s e libera veículo", async (kmFinal) => {
    emTransito();
    await executarViagem(id, id, { ...retorno, kmFinal });
    expect(tx.veiculo.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "DISPONIVEL", odometroAtual: kmFinal },
    });
    expect(tx.solicitacaoViagem.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "CONCLUIDA" },
    });
    expect(tx.execucaoViagem.update).toHaveBeenCalledWith({
      where: { solicitacaoId: id },
      data: { ...retorno, kmFinal, dataHoraFim: expect.any(Date) },
    });
  });
  it("mantém o veículo em manutenção ao concluir", async () => {
    emTransito();
    tx.veiculo.findUniqueOrThrow.mockResolvedValue({
      ativo: true,
      status: "MANUTENCAO",
      odometroAtual: new Prisma.Decimal(100),
    });
    await executarViagem(id, id, retorno);
    expect(tx.veiculo.update).toHaveBeenCalledWith({ where: { id }, data: { odometroAtual: 120 } });
    expect(tx.motorista.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "DISPONIVEL" },
    });
    expect(tx.auditoriaSistema.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dadosNovos: { status: "CONCLUIDA", kmFinal: 120 } }),
    });
  });

  it("rejeita km final menor sem alterar registros", async () => {
    emTransito();
    await expect(executarViagem(id, id, { ...retorno, kmFinal: 99 })).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(tx.execucaoViagem.update).not.toHaveBeenCalled();
    expect(tx.veiculo.update).not.toHaveBeenCalled();
  });
  it("impede outro motorista de executar a viagem", async () => {
    await expect(executarViagem(id, "outro", saida)).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.execucaoViagem.create).not.toHaveBeenCalled();
  });
  it("impede iniciar duas vezes", async () => {
    emTransito();
    await expect(executarViagem(id, id, saida)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("retorna 404 para viagem inexistente", async () => {
    tx.solicitacaoViagem.findUnique.mockResolvedValue(null);
    await expect(executarViagem(id, id, saida)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("valida odômetro numérico e checklist obrigatório", () => {
    expect(iniciarViagemSchema.safeParse(saida).success).toBe(true);
    expect(iniciarViagemSchema.safeParse({ ...saida, checklistSaida: {} }).success).toBe(false);
    expect(
      concluirViagemSchema.safeParse({
        ...retorno,
        checklistRetorno: { ...retorno.checklistRetorno, fotoOdometro: "" },
      }).success,
    ).toBe(false);
    for (const kmInicial of [-1, Infinity, "100", 0.001]) {
      expect(iniciarViagemSchema.safeParse({ ...saida, kmInicial }).success).toBe(false);
    }
    expect(concluirViagemSchema.safeParse({ kmFinal: 120 }).success).toBe(false);
    expect(iniciarViagemSchema.safeParse({ ...saida, checklistSaida: null }).success).toBe(false);
  });
});
