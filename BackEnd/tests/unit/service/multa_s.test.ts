import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    multaFindUnique: vi.fn(),
    multaFindMany: vi.fn(),
    multaCount: vi.fn(),
    multaAggregate: vi.fn(),
    multaCreate: vi.fn(),
    multaUpdate: vi.fn(),
    veiculoFindUnique: vi.fn(),
    motoristaFindUnique: vi.fn(),
    solicitacaoFindUnique: vi.fn(),
    registrarAuditoria: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    multaInfracao: {
      findUnique: mocks.multaFindUnique,
      findMany: mocks.multaFindMany,
      count: mocks.multaCount,
      aggregate: mocks.multaAggregate,
      create: mocks.multaCreate,
      update: mocks.multaUpdate,
    },
    veiculo: {
      findUnique: mocks.veiculoFindUnique,
    },
    motorista: {
      findUnique: mocks.motoristaFindUnique,
    },
    solicitacaoViagem: {
      findUnique: mocks.solicitacaoFindUnique,
    },
  },
}));

vi.mock("../../../src/service/auditoria_s", () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

import {
  atualizarMulta,
  criarMulta,
  listarMultas,
  obterMultaPorId,
  obterResumoMultasMotorista,
} from "../../../src/service/multa_s";

const veiculoId = "00000000-0000-4000-8000-000000000001";
const motoristaId = "00000000-0000-4000-8000-000000000002";
const solicitacaoId = "00000000-0000-4000-8000-000000000003";
const multaId = "00000000-0000-4000-8000-000000000004";
const usuarioAdminId = "00000000-0000-4000-8000-000000000005";

describe("Serviço de Multas e Infrações (multa_s)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listarMultas", () => {
    it("lista multas com paginação e totalizadores", async () => {
      const multasMock = [
        {
          id: multaId,
          autoInfracao: "AUTO-12345",
          veiculoId,
          motoristaId,
          dataHora: new Date("2026-11-04T10:00:00Z"),
          gravidade: "GRAVE",
          pontos: 5,
          valor: 195.23,
          status: "PENDENTE",
          veiculo: { id: veiculoId, placa: "XYZ1234", modelo: "Chevrolet S10", tipoFrota: "SVO" },
          motorista: {
            id: motoristaId,
            numeroCnh: "12345678901",
            cpf: "111.222.333-44",
            usuario: { id: "u1", nome: "Carlos Condutor", email: "carlos@fsph.se.gov.br" },
          },
          solicitacao: null,
        },
      ];

      mocks.multaFindMany.mockResolvedValue(multasMock);
      mocks.multaCount.mockResolvedValue(1);
      mocks.multaAggregate.mockResolvedValue({
        _sum: { valor: 195.23, pontos: 5 },
      });

      const resultado = await listarMultas({
        page: 1,
        pageSize: 10,
        status: "PENDENTE",
      });

      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].autoInfracao).toBe("AUTO-12345");
      expect(resultado.meta.total).toBe(1);
      expect(resultado.meta.valorTotal).toBe(195.23);
      expect(resultado.meta.totalPontos).toBe(5);
    });
  });

  describe("obterMultaPorId", () => {
    it("retorna multa existente com detalhes", async () => {
      mocks.multaFindUnique.mockResolvedValue({
        id: multaId,
        autoInfracao: "AUTO-9999",
        valor: 293.47,
        veiculo: { placa: "ABC1D23" },
      });

      const multa = await obterMultaPorId(multaId);
      expect(multa.id).toBe(multaId);
      expect(multa.valor).toBe(293.47);
    });

    it("lança 404 se a multa não for encontrada", async () => {
      mocks.multaFindUnique.mockResolvedValue(null);

      await expect(obterMultaPorId(multaId)).rejects.toMatchObject({
        statusCode: 404,
        message: "Multa ou infração não encontrada.",
      });
    });
  });

  describe("criarMulta", () => {
    it("cria multa com sucesso calculando pontos padrão pela gravidade", async () => {
      mocks.multaFindUnique.mockResolvedValue(null); // auto não existe
      mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: true });
      mocks.motoristaFindUnique.mockResolvedValue({ id: motoristaId, ativo: true });
      mocks.solicitacaoFindUnique.mockResolvedValue({ id: solicitacaoId });
      mocks.multaCreate.mockResolvedValue({
        id: multaId,
        autoInfracao: "AUTO-FSPH-01",
        veiculoId,
        motoristaId,
        gravidade: "GRAVISSIMA",
        pontos: 7,
        valor: 880.41,
        status: "PENDENTE",
        veiculo: { placa: "XYZ1234", modelo: "Van Master" },
        motorista: { numeroCnh: "12345678901", usuario: { nome: "João Silva" } },
      });

      const nova = await criarMulta(
        {
          autoInfracao: "AUTO-FSPH-01",
          veiculoId,
          motoristaId,
          solicitacaoId,
          dataHora: new Date("2026-11-04T14:30:00Z"),
          gravidade: "GRAVISSIMA",
          valor: 880.41,
          status: "PENDENTE",
        },
        usuarioAdminId,
      );

      expect(nova.id).toBe(multaId);
      expect(nova.pontos).toBe(7);
      expect(mocks.multaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            autoInfracao: "AUTO-FSPH-01",
            pontos: 7,
          }),
        }),
      );
      expect(mocks.registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: "CRIAR_MULTA",
          registroId: multaId,
        }),
      );
    });

    it("recusa auto de infração duplicado com 409", async () => {
      mocks.multaFindUnique.mockResolvedValue({ id: "existente", autoInfracao: "AUTO-DUP" });

      await expect(
        criarMulta({
          autoInfracao: "AUTO-DUP",
          veiculoId,
          dataHora: new Date(),
          gravidade: "LEVE",
          valor: 88.38,
          status: "PENDENTE",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("recusa veículo inativo com 400", async () => {
      mocks.multaFindUnique.mockResolvedValue(null);
      mocks.veiculoFindUnique.mockResolvedValue({ id: veiculoId, ativo: false });

      await expect(
        criarMulta({
          autoInfracao: "AUTO-NEW",
          veiculoId,
          dataHora: new Date(),
          gravidade: "MEDIA",
          valor: 130.16,
          status: "PENDENTE",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "O veículo informado não foi encontrado ou está inativo.",
      });
    });
  });

  describe("atualizarMulta", () => {
    it("atualiza status e data de pagamento registrando auditoria", async () => {
      mocks.multaFindUnique.mockResolvedValue({
        id: multaId,
        status: "PENDENTE",
      });
      mocks.multaUpdate.mockResolvedValue({
        id: multaId,
        status: "PAGA",
        dataPagamento: new Date("2026-11-04T16:00:00Z"),
        valor: 195.23,
        veiculo: { placa: "ABC1234", modelo: "S10" },
        motorista: null,
      });

      const atualizada = await atualizarMulta(
        multaId,
        {
          status: "PAGA",
          dataPagamento: new Date("2026-11-04T16:00:00Z"),
        },
        usuarioAdminId,
      );

      expect(atualizada.status).toBe("PAGA");
      expect(mocks.registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: "ATUALIZAR_MULTA",
        }),
      );
    });
  });

  describe("obterResumoMultasMotorista", () => {
    it("retorna histórico e somatório de multas do condutor", async () => {
      mocks.multaFindMany.mockResolvedValue([
        { id: "m1", valor: 100, pontos: 4, veiculo: { placa: "AAA1111", modelo: "Spin" } },
        { id: "m2", valor: 200, pontos: 5, veiculo: { placa: "BBB2222", modelo: "S10" } },
      ]);
      mocks.multaAggregate.mockResolvedValue({
        _count: { id: 2 },
        _sum: { pontos: 9, valor: 300 },
      });

      const resumo = await obterResumoMultasMotorista(motoristaId);
      expect(resumo.totalMultas).toBe(2);
      expect(resumo.totalPontos).toBe(9);
      expect(resumo.valorTotal).toBe(300);
      expect(resumo.multas).toHaveLength(2);
    });
  });
});
