import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/sessao", (route) =>
    route.fulfill({ status: 401, json: { message: "Autenticação necessária." } }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "a".repeat(64) } }),
  );
  await page.goto("/");
});

test("exibe o login e permite consultar a orientação de recuperação de senha", async ({
  page,
}, testInfo) => {
  await expect(page).toHaveTitle(/Rota.*FSPH/);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login.png") });
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Está com problemas para acessar o sistema?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperação de senha" })).toBeVisible();
  await expect(page.getByText(/Entre em contato com o suporte da FSPH/)).toBeVisible();

  await page.getByRole("button", { name: "Voltar para o login" }).click();
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
});

test("valida a senha antes de enviar as credenciais", async ({ page }) => {
  const loginRequests: string[] = [];
  await page.route("**/api/v1/auth/login", async (route) => {
    loginRequests.push(route.request().url());
    await route.abort();
  });
  await page.getByLabel("E-mail", { exact: true }).fill("teste@fsph.se.gov.br");
  await page.getByLabel("Senha", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Acessar", exact: true }).click();

  await expect(page.getByText("A senha deve possuir pelo menos 6 caracteres.")).toBeVisible();
  expect(loginRequests).toEqual([]);
});

test("envia as credenciais e apresenta a rejeição da API", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({ status: 401, json: { error: "Credenciais inválidas" } }),
  );
  await page.getByLabel("E-mail", { exact: true }).fill("teste@fsph.se.gov.br");
  await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
  const requestPromise = page.waitForRequest("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Acessar", exact: true }).click();
  const request = await requestPromise;

  expect(request.method()).toBe("POST");
  expect(request.postDataJSON()).toEqual({
    email: "teste@fsph.se.gov.br",
    senha: "senha-incorreta",
  });
  await expect(page.getByText("Credenciais inválidas", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acessar", exact: true })).toBeEnabled();
});

test("restaura a sessão pelo servidor sem credenciais no localStorage e revoga no logout", async ({
  page,
}) => {
  let active = true;
  await page.route("**/api/v1/auth/sessao", (route) =>
    active
      ? route.fulfill({
          json: {
            usuario: {
              id: "test",
              nome: "Pessoa Teste",
              email: "teste@example.test",
              perfis: ["MOTORISTA"],
            },
          },
        })
      : route.fulfill({ status: 401, json: { message: "Sessão encerrada" } }),
  );
  await page.route("**/api/v1/auth/logout", async (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("a".repeat(64));
    active = false;
    await route.fulfill({ status: 204 });
  });
  await page.evaluate(() => localStorage.removeItem("@fsph_frota_session_activity"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Minhas Viagens" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("button", { name: "Encerrar sessão" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("@fsph_frota_token"))).toBeNull();
  await page.getByRole("button", { name: "Encerrar sessão" }).click();
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
});

test("encerra a sessão após 30 minutos de inatividade no navegador", async ({ page }) => {
  await page.clock.install();
  let logoutCalls = 0;
  await page.route("**/api/v1/auth/sessao", (route) =>
    route.fulfill({
      json: {
        usuario: {
          id: "timer-test",
          nome: "Pessoa Timer",
          email: "timer@example.test",
          perfis: ["MOTORISTA"],
        },
      },
    }),
  );
  await page.route("**/api/v1/auth/logout", (route) => {
    logoutCalls++;
    return route.fulfill({ status: 204 });
  });
  await page.evaluate(() => localStorage.removeItem("@fsph_frota_session_activity"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Minhas Viagens" })).toBeVisible();
  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
  await expect.poll(() => logoutCalls).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
});
