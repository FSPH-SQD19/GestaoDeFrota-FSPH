import { expect, test } from "@playwright/test";
test.use({ serviceWorkers: "allow" });
test("PWA mantém interface e saída confirmada após recarregar sem rede", async ({
  page,
  context,
}) => {
  let offline = false;
  const userId = "00000000-0000-4000-8000-000000000001";
  const saida = {
    id: "00000000-0000-4000-8000-000000000002",
    motoristaId: userId,
    veiculoId: "00000000-0000-4000-8000-000000000003",
    tipo: "ADMINISTRATIVA",
    status: "EM_ANDAMENTO",
    inicio: new Date().toISOString(),
    fim: null,
    kmInicial: "100",
    kmFinal: null,
    pontos: [],
    ordens: [],
  };
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
  await page.route("**/api/v1/**", (r) => {
    if (offline) return r.abort("internetdisconnected");
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/auth/sessao"))
      return r.fulfill({
        json: {
          usuario: {
            id: userId,
            nome: "Motorista Offline",
            email: "offline@test.invalid",
            perfis: ["MOTORISTA"],
          },
        },
      });
    if (path.endsWith("/motorista/config")) return r.fulfill({ json: { enabled: true } });
    if (path.endsWith("/motorista/fornecedores")) return r.fulfill({ json: [] });
    if (path.endsWith("/motorista/tarefas"))
      return r.fulfill({
        json: {
          motorista: { id: userId },
          administrativas: [],
          ordens: [],
          ativa: saida,
          historico: [],
          sessaoExpiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
        },
      });
    return r.fulfill({ status: 404, json: { message: "Não encontrado" } });
  });
  await page.goto("/motorista");
  await expect(page.getByRole("navigation", { name: "Navegação do motorista" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("@fsph_frota_saida_session")))
    .not.toBeNull();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect((await manifest.json()).start_url).toBe("/motorista");
  const privateCache = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = (
      await Promise.all(
        names.map(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url)),
      )
    ).flat();
    return urls.some((url) => new URL(url).pathname.startsWith("/api/"));
  });
  expect(privateCache).toBe(false);
  offline = true;
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation", { name: "Navegação do motorista" })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar viagem", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Retorno e encerramento" })).toBeVisible();
  await expect(page.getByText(/Sem internet/)).toBeVisible();
  await context.setOffline(false);
});
