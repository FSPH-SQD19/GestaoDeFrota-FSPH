import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../src/services/api";
import { apiRequest } from "../../../src/lib/api";
vi.mock("../../../src/services/api", () => ({ api: { request: vi.fn() } }));
beforeEach(() => {
  vi.mocked(api.request).mockReset();
});
describe("erros de validação da API", () => {
  it("exibe detalhes de campo no lugar da mensagem genérica", async () => {
    vi.mocked(api.request).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          message: "Dados inválidos.",
          errors: [
            { campo: "origem", mensagem: "Informe a origem." },
            { campo: "destino", mensagem: "Informe o destino." },
          ],
        },
      },
    });
    await expect(apiRequest("/solicitacoes")).rejects.toThrow(
      "Informe a origem. Informe o destino.",
    );
  });
  it("ignora detalhes inválidos e conserva a mensagem da API", async () => {
    vi.mocked(api.request).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: "Conflito no cadastro.", errors: [null, {}, " "] },
      },
    });
    await expect(apiRequest("/solicitacoes")).rejects.toThrow("Conflito no cadastro.");
  });
});
