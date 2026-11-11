import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/lib/prisma", () => ({ prisma: {} }));
import { notificarRevisaoPreventiva } from "../../../src/service/notificacao_s";

const usuarios = vi.fn();
const notificar = vi.fn();
const tx = {
  usuario: { findMany: usuarios },
  notificacao: { createMany: notificar },
} as unknown as Prisma.TransactionClient;
const veiculo = { id: "v1", placa: "ABC1234", kmProximaRevisao: new Prisma.Decimal("10000") };

beforeEach(() => {
  vi.resetAllMocks();
  usuarios.mockResolvedValue([{ id: "gestor" }, { id: "admin" }]);
  notificar.mockResolvedValue({ count: 2 });
});
describe("alertas de revisão por quilometragem", () => {
  it.each([null, new Prisma.Decimal(0)])(
    "ignora limite ausente ou inválido %s",
    async (kmProximaRevisao) => {
      await notificarRevisaoPreventiva(tx, { ...veiculo, kmProximaRevisao }, 10000);
      expect(usuarios).not.toHaveBeenCalled();
      expect(notificar).not.toHaveBeenCalled();
    },
  );
  it("não alerta imediatamente abaixo de 90%", async () => {
    await notificarRevisaoPreventiva(tx, veiculo, 8999.99);
    expect(notificar).not.toHaveBeenCalled();
    expect(usuarios).not.toHaveBeenCalled();
  });
  it.each([
    [9000, "REVISAO_PREVENTIVA_PROXIMA"],
    [9999.99, "REVISAO_PREVENTIVA_PROXIMA"],
    [10000, "REVISAO_PREVENTIVA_VENCIDA"],
    [10000.01, "REVISAO_PREVENTIVA_VENCIDA"],
  ])("usa o estágio correto para %s km", async (odometro, tipo) => {
    await notificarRevisaoPreventiva(tx, veiculo, odometro);
    expect(usuarios).toHaveBeenCalledWith({
      where: { ativo: true, perfis: { some: { perfil: { nome: { in: ["ADMIN", "GESTOR"] } } } } },
      select: { id: true },
    });
    expect(notificar).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId: "gestor",
          tipo,
          referenciaId: "v1",
          referenciaTipo: "VEICULO",
        }),
        expect.objectContaining({ usuarioId: "admin", tipo, referenciaId: "v1" }),
      ],
      skipDuplicates: true,
    });
  });
  it("calcula limites fracionários com Decimal", async () => {
    const fracionado = { ...veiculo, kmProximaRevisao: new Prisma.Decimal("1000.01") };
    await notificarRevisaoPreventiva(tx, fracionado, 900);
    expect(notificar).not.toHaveBeenCalled();
    await notificarRevisaoPreventiva(tx, fracionado, 900.01);
    expect(notificar).toHaveBeenCalledTimes(1);
  });
  it("mantém a chave entre eventos e distingue estágio, limite e destinatário", async () => {
    await notificarRevisaoPreventiva(tx, veiculo, 9000);
    await notificarRevisaoPreventiva(tx, veiculo, 9500);
    await notificarRevisaoPreventiva(tx, veiculo, 10000);
    await notificarRevisaoPreventiva(
      tx,
      { ...veiculo, kmProximaRevisao: new Prisma.Decimal("11000") },
      10000,
    );
    const chaves = notificar.mock.calls.map(([dados]) =>
      dados.data.map((item: { chaveUnica: string }) => item.chaveUnica),
    );
    expect(chaves[0]).toEqual(chaves[1]);
    expect(chaves[0]![0]).not.toBe(chaves[0]![1]);
    expect(chaves[0]![0]).not.toBe(chaves[2]![0]);
    expect(chaves[0]![0]).not.toBe(chaves[3]![0]);
  });
  it("gera apenas o alerta de 100% quando a leitura salta os dois limites", async () => {
    await notificarRevisaoPreventiva(tx, veiculo, 12000);
    expect(notificar.mock.calls[0]![0].data).toHaveLength(2);
    expect(
      notificar.mock.calls[0]![0].data.every(
        (item: { tipo: string }) => item.tipo === "REVISAO_PREVENTIVA_VENCIDA",
      ),
    ).toBe(true);
  });
  it("não tenta persistir quando não há destinatários ativos", async () => {
    usuarios.mockResolvedValue([]);
    await notificarRevisaoPreventiva(tx, veiculo, 9000);
    expect(notificar).not.toHaveBeenCalled();
  });
});
