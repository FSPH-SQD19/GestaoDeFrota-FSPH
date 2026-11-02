import { describe, expect, it } from "vitest";
import { veiculoSchema } from "../../../src/pages/veiculos/veiculoRules";
const dados = {
  placa: "abc-1234",
  modelo: " Modelo ",
  tipoFrota: "ADMINISTRATIVA",
  capacidadeMaxima: "4",
  ano: "",
  combustivel: "",
};
describe("validação do cadastro de veículo", () => {
  it("normaliza a placa, textos e campos opcionais conforme o contrato existente", () => {
    expect(veiculoSchema.parse(dados)).toEqual({
      placa: "ABC1234",
      modelo: "Modelo",
      tipoFrota: "ADMINISTRATIVA",
      capacidadeMaxima: 4,
      ano: undefined,
      combustivel: undefined,
    });
    expect(veiculoSchema.safeParse({ ...dados, placa: "ABC1D23", ano: "1950" }).success).toBe(true);
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
