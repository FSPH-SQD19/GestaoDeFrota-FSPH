import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../src/services/api";
import { apiRequest } from "../../../src/lib/api";
vi.mock("../../../src/services/api", () => ({ api: { request: vi.fn() } }));
beforeEach(() => {
  vi.mocked(api.request).mockReset();
});
describe("erros de validação da API", () => {
  it.each([
    [
      "ERR_NETWORK",
      "Não foi possível conectar ao sistema. Verifique sua conexão e tente novamente.",
    ],
    ["ECONNABORTED", "O sistema demorou para responder. Aguarde um momento e tente novamente."],
  ])("orienta o usuário em falhas de conexão %s", async (code, mensagem) => {
    vi.mocked(api.request).mockRejectedValue({
      isAxiosError: true,
      code,
      message: "Network Error",
    });
    await expect(apiRequest("/motoristas")).rejects.toThrow(mensagem);
  });

  it("envia o objeto diretamente para o cliente HTTP", async () => {
    vi.mocked(api.request).mockResolvedValue({ data: { id: "solicitacao" } });
    const data = { destino: "HEMOSE", quantidadePassageiros: 2 };

    await expect(apiRequest("/solicitacoes", { method: "POST", data })).resolves.toEqual({
      id: "solicitacao",
    });
    expect(api.request).toHaveBeenCalledWith({ url: "/api/v1/solicitacoes", method: "POST", data });
    expect(vi.mocked(api.request).mock.calls[0]?.[0].data).toBe(data);
  });

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
