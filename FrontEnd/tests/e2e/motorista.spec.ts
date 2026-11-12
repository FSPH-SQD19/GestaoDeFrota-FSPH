import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
async function screenshotPath(project: string, name: string) {
  const dir = process.env.ROTA_QA_DIR || join(tmpdir(), "rota-pwa-qa");
  await mkdir(dir, { recursive: true });
  return join(dir, `${project}-${name}`);
}
import { expect, test } from "@playwright/test";
test.use({ serviceWorkers: "block" });
const userId = "00000000-0000-4000-8000-000000000001",
  veiculoId = "00000000-0000-4000-8000-000000000002",
  tarefaId = "00000000-0000-4000-8000-000000000003";
test("motorista inicia, registra abastecimento offline e sincroniza sem duplicar", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let ativa: Record<string, unknown> | null = null;
  const historico: unknown[] = [];
  const comandos = new Set<string>();
  let abastecimentos = 0;
  const veiculo = { id: veiculoId, placa: "ROTA1234", modelo: "Fiat Cronos", odometroAtual: "100" };
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("https://tiles.openfreemap.org/**", (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: "fundo", type: "background", paint: { "background-color": "#e2e8f0" } }],
      },
    }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/sessao"))
      return route.fulfill({
        json: {
          usuario: {
            id: userId,
            nome: "Motorista Demonstração",
            email: "motorista@test.invalid",
            perfis: ["MOTORISTA"],
          },
        },
      });
    if (path.endsWith("/auth/csrf")) return route.fulfill({ json: { csrfToken: "a".repeat(64) } });
    if (path.endsWith("/motorista/config")) return route.fulfill({ json: { enabled: true } });
    if (path.endsWith("/motorista/fornecedores")) return route.fulfill({ json: [] });
    if (path.endsWith("/motorista/tarefas"))
      return route.fulfill({
        json: {
          motorista: { id: userId },
          administrativas: ativa
            ? []
            : [
                {
                  id: tarefaId,
                  protocolo: "SV-2026-0001",
                  origem: "FSPH",
                  destino: "Hospital Regional",
                  veiculoAlocado: veiculo,
                },
              ],
          ordens: [],
          ativa,
          historico,
          sessaoExpiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
        },
      });
    if (path.endsWith("/motorista/saidas")) {
      const body = route.request().postDataJSON();
      ativa = {
        id: body.id,
        motoristaId: userId,
        veiculoId,
        tipo: "ADMINISTRATIVA",
        status: "EM_ANDAMENTO",
        inicio: new Date().toISOString(),
        fim: null,
        kmInicial: "100",
        kmFinal: null,
        pontos: [{ id: "destino", nome: "Hospital Regional", coordenadas: [-37.1, -10.9] }],
        ordens: [],
      };
      return route.fulfill({ json: ativa });
    }
    if (path.endsWith("/comandos")) {
      const c = route.request().postDataJSON();
      if (!comandos.has(c.id)) {
        comandos.add(c.id);
        if (c.tipo === "ABASTECIMENTO") abastecimentos++;
        if (c.tipo === "ENCERRAR") {
          ativa = { ...ativa, status: "CONCLUIDA", kmFinal: String(c.kmFinal), fim: c.dataHora };
          historico.push(ativa);
          const resposta = ativa;
          ativa = null;
          return route.fulfill({ json: resposta });
        }
      }
      return route.fulfill({ json: ativa });
    }
    if (path.endsWith("/posicoes")) return route.fulfill({ json: { aceitas: [] } });
    if (path.endsWith("/rota"))
      return route.fulfill({
        status: 503,
        json: { message: "Serviço de rotas temporariamente indisponível." },
      });
    return route.fulfill({ status: 404, json: { message: "Não encontrado" } });
  });
  await page.goto("/motorista");
  await expect(page).toHaveTitle(/Rota.*FSPH/);
  await expect(page.getByRole("navigation", { name: "Navegação do motorista" })).toBeVisible();
  await page.getByRole("button", { name: "Preparar saída", exact: true }).click();
  await expect(page.getByText("ROTA1234", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Freios de saída", { exact: true }).selectOption("PROBLEMA");
  await expect(page.getByLabel("Observação Freios de saída")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar viagem", exact: true })).toBeDisabled();
  await expect(page.getByText(/precisam ser resolvidos antes de iniciar/)).toBeVisible();
  await page.getByLabel("Freios de saída", { exact: true }).selectOption("CONFORME");
  await page.getByRole("button", { name: "Iniciar viagem", exact: true }).click();
  await expect(page.getByRole("button", { name: "Finalizar viagem", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));
  });
  await page.getByRole("button", { name: "Abastecer", exact: true }).click();
  await page.getByLabel("Odômetro do abastecimento").fill("110");
  await page.getByLabel("Litros", { exact: true }).fill("10");
  await page.getByLabel("Valor total (R$)").fill("60");
  await page.getByRole("button", { name: "Salvar abastecimento" }).click();
  await expect(page.getByRole("button", { name: /1 lançamento pendente/ })).toBeVisible();
  expect(abastecimentos).toBe(0);
  await page.getByRole("navigation", { name: "Navegação do motorista" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("motorista-offline.png"), fullPage: true });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.getByRole("button", { name: /1 lançamento pendente/ })).toHaveCount(0);
  expect(abastecimentos).toBe(1);
  await page.getByRole("button", { name: "Finalizar viagem", exact: true }).click();
  await page.getByLabel("Odômetro final (km)").fill("120");
  await page.getByRole("button", { name: "Confirmar retorno e encerrar" }).click();
  await expect(page.getByRole("button", { name: "Finalizar viagem", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("100 → 120 km · Concluída")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.getByRole("navigation", { name: "Navegação do motorista" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("motorista-historico.png"), fullPage: true });
});

test("central confirma pinos e locais e indica ausência de GPS", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let saved: unknown = null;
  const locais: Array<{ id: string; nome: string; coordenadas: number[]; tipo: string }> = [];
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("https://tiles.openfreemap.org/**", (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: "fundo", type: "background", paint: { "background-color": "#e2e8f0" } }],
      },
    }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/sessao"))
      return route.fulfill({
        json: {
          usuario: {
            id: userId,
            nome: "Central Demonstração",
            email: "central@test.invalid",
            perfis: ["GESTOR"],
          },
        },
      });
    if (path.endsWith("/auth/csrf")) return route.fulfill({ json: { csrfToken: "a".repeat(64) } });
    if (path.endsWith("/motorista/config")) return route.fulfill({ json: { enabled: true } });
    if (path.endsWith("/rastreamento/posicoes"))
      return route.fulfill({
        json: [
          {
            saidaId: tarefaId,
            coordenadas: null,
            capturadaEm: null,
            precisao: null,
            tipo: "ADMINISTRATIVA",
            placa: "ROTA1234",
            nome: "Motorista Demonstração",
          },
        ],
      });
    if (path.endsWith("/rastreamento/saidas"))
      return route.fulfill({
        json: [
          {
            id: tarefaId,
            tipo: "ADMINISTRATIVA",
            inicio: new Date().toISOString(),
            status: "CONCLUIDA",
          },
        ],
      });
    if (path.endsWith(`/rastreamento/saidas/${tarefaId}/percurso`))
      return route.fulfill({ json: [{ coordenadas: [-37.07, -10.91] }] });
    if (path.endsWith("/geografia/tarefas"))
      return route.fulfill({
        json: {
          administrativas: [
            {
              id: tarefaId,
              protocolo: "SV-2026-0001",
              origemCoordenadas: [],
              destinoCoordenadas: [],
            },
          ],
          ordens: [],
        },
      });
    if (path.endsWith(`/geografia/${tarefaId}`)) {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/locais")) {
      if (route.request().method() === "POST")
        locais.push({ id: veiculoId, ...route.request().postDataJSON() });
      return route.fulfill({ json: locais });
    }
    return route.fulfill({ status: 404, json: { message: "Não encontrado" } });
  });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await expect(menu).toBeVisible();
    await menu.click();
  }
  await page.getByRole("button", { name: "Mapa e operação", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mapa e operação" })).toBeVisible();
  await expect(page.getByText("Aguardando posição", { exact: false })).toBeVisible();
  await page.getByLabel("Viagem ou ordem").selectOption(tarefaId);
  await page
    .getByRole("region", { name: "Mapa operacional" })
    .click({ position: { x: 180, y: 150 } });
  await expect(page.getByLabel("Longitude", { exact: true }).nth(0)).not.toHaveValue("");
  await page.getByLabel("Longitude", { exact: true }).nth(0).fill("-37.07");
  await page.getByLabel("Latitude", { exact: true }).nth(0).fill("-10.91");
  await page.getByLabel("Longitude", { exact: true }).nth(1).fill("-37.1");
  await page.getByLabel("Latitude", { exact: true }).nth(1).fill("-10.95");
  await page.getByLabel("Salvar ponto selecionado como local").fill("Base FSPH");
  await page.getByRole("button", { name: "Salvar local", exact: true }).click();
  await expect(page.getByRole("option", { name: "Base FSPH" })).toHaveCount(1);
  await page.getByRole("button", { name: "Confirmar pontos", exact: true }).click();
  await expect
    .poll(() => saved)
    .toEqual({ tipo: "ADMINISTRATIVA", origem: [-37.07, -10.91], destino: [-37.1, -10.95] });
  await page.getByLabel("Consultar percurso").selectOption(tarefaId);
  await expect(page.locator(".maplibregl-marker")).toHaveCount(1);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.getByRole("heading", { name: "Mapa e operação" }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: await screenshotPath(testInfo.project.name, "central-operacional.png"),
    fullPage: false,
  });
});
