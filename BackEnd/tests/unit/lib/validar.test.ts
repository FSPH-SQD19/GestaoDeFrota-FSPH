import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validar } from "../../../src/lib/validar";

describe("mensagens públicas de validação", () => {
  it("substitui a mensagem técnica padrão sem alterar o campo rejeitado", () => {
    expect(() => validar(z.object({ capacidade: z.number() }), { capacidade: "texto" })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        errors: [
          {
            campo: "capacidade",
            mensagem: "Confira os dados informados neste campo e tente novamente.",
          },
        ],
      }),
    );
  });

  it("preserva orientações específicas de cada campo", () => {
    expect(() =>
      validar(z.object({ origem: z.string().min(3, "Informe o local de partida.") }), {
        origem: "",
      }),
    ).toThrow(
      expect.objectContaining({
        errors: [{ campo: "origem", mensagem: "Informe o local de partida." }],
      }),
    );
  });

  it("explica que zero não é permitido quando o valor deve ser positivo", () => {
    expect(() =>
      validar(z.object({ capacidade: z.number().positive() }), { capacidade: 0 }),
    ).toThrow(
      expect.objectContaining({
        errors: [{ campo: "capacidade", mensagem: "Informe um valor maior que 0." }],
      }),
    );
  });
});
