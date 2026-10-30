import { describe, expect, it } from "vitest";
import { motoristaCadastroSchema } from "../../../src/pages/motorista/MotoristaRules";
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const entrada = {
  nome: " Condutor ",
  email: " CONDUTOR@example.test ",
  senha: "senha123",
  telefone: "(79) 99999-1234",
  cpf: "123.456.789-09",
  numeroCnh: "12345678901",
  categoriaCnh: "B",
  validadeCnh: hoje,
};
describe("cadastro de motorista", () => {
  it("aceita validade até hoje e normaliza os dados do contrato", () => {
    expect(motoristaCadastroSchema.parse(entrada)).toMatchObject({
      nome: "Condutor",
      email: "condutor@example.test",
      cpf: "12345678909",
      telefone: "79999991234",
      validadeCnh: hoje,
    });
  });
  it.each([
    { nome: " " },
    { email: "inválido" },
    { senha: "123" },
    { senha: "á".repeat(37) },
    { cpf: "11111111111" },
    { numeroCnh: "123" },
    { categoriaCnh: "X" },
    { validadeCnh: "2026-02-30" },
    { validadeCnh: "2000-01-01" },
    { telefone: "9999" },
  ])("rejeita dados inválidos %j", (dados) => {
    expect(motoristaCadastroSchema.safeParse({ ...entrada, ...dados }).success).toBe(false);
  });
});
