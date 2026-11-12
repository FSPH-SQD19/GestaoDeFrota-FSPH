import { describe, expect, it } from "vitest";
import { documentoVeiculoSchema, veiculoSchema } from "../../../src/pages/veiculos/veiculoRules";
const dados = {
  placa: "abc-1234",
  modelo: " Modelo ",
  tipoFrota: "ADMINISTRATIVA",
  propriedade: "PROPRIO",
  fornecedorId: "",
  capacidadeMaxima: "4",
  ano: "",
  combustivel: "",
};
const locadoraId = "00000000-0000-4000-8000-0000000000f1";
describe("validação do cadastro de veículo", () => {
  it("normaliza a placa, textos e campos opcionais conforme o contrato existente", () => {
    expect(veiculoSchema.parse(dados)).toEqual({
      placa: "ABC1234",
      modelo: "Modelo",
      tipoFrota: "ADMINISTRATIVA",
      propriedade: "PROPRIO",
      capacidadeMaxima: 4,
      ano: undefined,
      combustivel: undefined,
    });
    expect(veiculoSchema.safeParse({ ...dados, placa: "ABC1D23", ano: "1950" }).success).toBe(true);
  });
  it("exige locadora válida quando o veículo é locado", () => {
    expect(
      veiculoSchema.safeParse({ ...dados, propriedade: "LOCADO", fornecedorId: "" }).success,
    ).toBe(false);
    expect(
      veiculoSchema.parse({
        ...dados,
        propriedade: "LOCADO",
        fornecedorId: locadoraId,
      }),
    ).toMatchObject({ propriedade: "LOCADO", fornecedorId: locadoraId });
  });
  it.each([
    { placa: "ABCDEFG" },
    { modelo: "  " },
    { capacidadeMaxima: "" },
    { capacidadeMaxima: "1.5" },
    { capacidadeMaxima: "51" },
    { ano: "1949" },
    { ano: String(new Date().getFullYear() + 2) },
    { ano: "2024.5" },
    { combustivel: "a".repeat(31) },
  ])("rejeita dados fora do contrato: %j", (alteracao) => {
    expect(veiculoSchema.safeParse({ ...dados, ...alteracao }).success).toBe(false);
  });
});

describe("validação de documento do veículo", () => {
  it("aceita tipos suportados pela API", () => {
    expect(
      documentoVeiculoSchema.parse({ tipoDocumento: "VISTORIA", dataVencimento: "2027-03-31" }),
    ).toEqual({ tipoDocumento: "VISTORIA", dataVencimento: "2027-03-31" });
  });
  it.each([
    { tipoDocumento: "CNH", dataVencimento: "2027-03-31" },
    { tipoDocumento: "IPVA", dataVencimento: "31/03/2027" },
    { tipoDocumento: "SEGURO", dataVencimento: "1999-12-31" },
  ])("rejeita %j", (corpo) => {
    expect(documentoVeiculoSchema.safeParse(corpo).success).toBe(false);
  });
});
