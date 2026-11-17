import type { Saida } from "../../src/features/motorista/types";
import { expect, test } from "@playwright/test";
test.use({ serviceWorkers: "block" });
test("motorista executa coletas em sequência com uma única ação principal", async ({ page }) => {
  const userId = "00000000-0000-4000-8000-000000000001",
    veiculoId = "00000000-0000-4000-8000-000000000002",
    ordem1 = "00000000-0000-4000-8000-000000000003",
    ordem2 = "00000000-0000-4000-8000-000000000004";
  const veiculo = { id: veiculoId, placa: "SVO1234", modelo: "Viatura SVO", odometroAtual: "100" };
  let ativa: Saida | null = null;
  let concluida = false;
  const comandos: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("https://tiles.openfreemap.org/**", (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: "fundo", type: "background", paint: { "background-color": "#e8efed" } }],
      },
    }),
  );
  await page.route("**/api/v1/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/auth/sessao"))
      return r.fulfill({
        json: {
          usuario: {
            id: userId,
            nome: "Motorista SVO",
            email: "svo@test.invalid",
            perfis: ["MOTORISTA"],
          },
        },
      });
    if (path.endsWith("/auth/csrf")) return r.fulfill({ json: { csrfToken: "a".repeat(64) } });
    if (path.endsWith("/motorista/config")) return r.fulfill({ json: { enabled: true } });
    if (path.endsWith("/motorista/fornecedores")) return r.fulfill({ json: [] });
    if (path.endsWith("/motorista/tarefas"))
      return r.fulfill({
        json: {
          motorista: { id: userId },
          administrativas: [],
          ordens: concluida
            ? []
            : [
                {
                  id: ordem1,
                  veiculo,
                  chamado: { enderecoOcorrencia: "Coleta São José" },
                  coordenadas: null,
                },
                {
                  id: ordem2,
                  veiculo,
                  chamado: { enderecoOcorrencia: "Coleta Atalaia" },
                  coordenadas: null,
                },
              ],
          ativa,
          historico: [],
          sessaoExpiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
        },
      });
    if (path.endsWith("/motorista/saidas")) {
      ativa = {
        id: r.request().postDataJSON().id,
        veiculoId,
        motoristaId: userId,
        tipo: "SVO",
        status: "EM_ANDAMENTO",
        inicio: new Date().toISOString(),
        kmInicial: "100",
        kmFinal: null,
        fim: null,
        pontos: [
          { id: ordem1, nome: "Coleta São José", coordenadas: null },
          { id: ordem2, nome: "Coleta Atalaia", coordenadas: null },
          { id: "base", nome: "Base FSPH", coordenadas: null },
        ],
        ordens: [
          { ordemId: ordem1, visitadaEm: null },
          { ordemId: ordem2, visitadaEm: null },
        ],
      };
      return r.fulfill({ json: ativa });
    }
    if (path.endsWith("/comandos")) {
      const c = r.request().postDataJSON();
      comandos.push(c.tipo);
      if (c.tipo === "VISITA")
        ativa!.ordens.find((o) => o.ordemId === c.ordemId)!.visitadaEm = new Date().toISOString();
      if (c.tipo === "ENCERRAR") {
        const response = { ...ativa, status: "CONCLUIDA", kmFinal: "130" };
        ativa = null;
        concluida = true;
        return r.fulfill({ json: response });
      }
      return r.fulfill({ json: ativa });
    }
    return r.fulfill({ status: 404, json: { message: "Não encontrado" } });
  });
  await page.goto("/motorista");
  await expect(page.getByRole("navigation", { name: "Navegação do motorista" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menu", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Preparar saída", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar viagem", exact: true }).click();
  await expect(page.getByText(/Coleta 1 de 2/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar coleta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coleta Atalaia", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Registrar coleta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Base FSPH", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar viagem", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Finalizar viagem", exact: true }).click();
  await page.getByLabel("Odômetro final (km)").fill("130");
  await page.getByRole("button", { name: "Confirmar retorno e encerrar" }).click();
  await expect(page.getByRole("heading", { name: "Nenhuma viagem atribuída" })).toBeVisible();
  expect(comandos).toEqual(["VISITA", "VISITA", "ENCERRAR"]);
  expect(errors).toEqual([]);
});
