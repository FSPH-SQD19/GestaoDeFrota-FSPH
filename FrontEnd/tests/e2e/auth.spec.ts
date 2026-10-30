import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("exibe o login e permite consultar a orientação de recuperação de senha", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
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

  await expect(page.getByText("A senha deve possuir pelo menos 4 caracteres.")).toBeVisible();
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
