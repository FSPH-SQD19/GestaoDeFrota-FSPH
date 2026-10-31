import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/auth", () => ({
  getAuthConfig: () => ({ secret: "svo-teste", expiresIn: 28800 }),
}));
vi.mock("../../../src/lib/prisma", () => ({ prisma: {} }));
vi.mock("../../../src/service/svo_s", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/service/svo_s")>()),
  indicadoresSvo: vi.fn(async () => ({ total: 0 })),
  listarChamadosSvo: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
  listarViaturasSvo: vi.fn(async () => []),
  listarMotoristasSvoDisponiveis: vi.fn(async () => []),
  registrarChamadoSvo: vi.fn(async () => ({ id: "chamado" })),
  realizarTriagemSvo: vi.fn(async () => ({ statusTriagem: "APROVADO" })),
  emitirOrdemColetaSvo: vi.fn(async () => ({ status: "EM_ANDAMENTO" })),
  concluirColetaSvo: vi.fn(async () => ({ status: "CONCLUIDA" })),
  concluirDesinfeccaoSvo: vi.fn(async () => ({ status: "DISPONIVEL" })),
}));
import { app } from "../../../src/app";
const id = "00000000-0000-4000-8000-000000000001";
let server: Server, url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/svo`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
async function request(method: string, path: string, perfil: string | null, body?: unknown) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(perfil
        ? {
            authorization: `Bearer ${jwt.sign({ perfis: [perfil] }, "svo-teste", { subject: id })}`,
          }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe("rotas canônicas SVO", () => {
  it.each([
    ["GET", "/indicadores", undefined, 200],
    ["GET", "/chamados", undefined, 200],
    ["GET", "/viaturas", undefined, 200],
    ["GET", "/motoristas", undefined, 200],
    [
      "POST",
      "/chamados",
      {
        nomeFalecido: "Nome teste",
        enderecoOcorrencia: "Rua teste",
        relatoOcorrencia: "Relato teste",
      },
      201,
    ],
    ["POST", `/chamados/${id}/ordens`, { veiculoId: id, motoristaId: id }, 201],
    ["PATCH", `/chamados/${id}/triagem`, { decisao: "APROVAR" }, 200],
    ["PATCH", `/chamados/${id}/concluir`, undefined, 200],
    ["PATCH", `/viaturas/${id}/desinfeccao`, undefined, 200],
  ])("protege e monta %s %s", async (method, path, body, status) => {
    expect((await request(method, path, null, body)).status).toBe(401);
    expect((await request(method, path, "GESTOR", body)).status).toBe(403);
    expect((await request(method, path, "SVO", body)).status).toBe(status);
    expect((await request(method, path, "ADMIN", body)).status).toBe(status);
  });
  it("rejeita ID e dados inválidos antes de executar a operação", async () => {
    expect((await request("PATCH", "/chamados/invalido/concluir", "SVO")).status).toBe(400);
    expect((await request("POST", `/chamados/${id}/ordens`, "SVO", {})).status).toBe(400);
    expect(
      (await request("PATCH", `/chamados/${id}/triagem`, "SVO", { decisao: "RECUSAR" })).status,
    ).toBe(400);
    expect((await request("GET", "/chamados?page=100000000000", "SVO")).status).toBe(400);
  });
});
