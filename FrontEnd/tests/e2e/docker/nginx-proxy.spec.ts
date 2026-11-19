import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendDocker =
  process.env.ROTA_QA_DOCKER_FRONTEND_URL ?? "http://127.0.0.1:5173";
const api = new URL("/api/v1", frontendDocker).toString();

type AcessoDemo = {
  senha: string;
  usuarios: { email: string; perfil: string }[];
};

function acessoDemo(): AcessoDemo {
  const caminho = process.env.ROTA_QA_DEMO_ACCESS
    ? resolve(process.env.ROTA_QA_DEMO_ACCESS)
    : resolve(process.cwd(), "../BackEnd/.runtime/demo-access.json");
  return JSON.parse(readFileSync(caminho, "utf8")) as AcessoDemo;
}

function respostaDaApi(page: Page, rota: string, metodo: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `${new URL(api).pathname}${rota}` && response.request().method() === metodo;
  });
}

test("Nginx Docker encaminha sessão, CSRF e login à API", async ({ page }) => {
  const sessaoPendente = respostaDaApi(page, "/auth/sessao", "GET");
  await page.goto(frontendDocker);
  const sessao = await sessaoPendente;
  expect(sessao.status(), "sessão sem autenticação").toBe(401);
  expect(sessao.headers()["content-type"]).toContain("application/json");

  const fallbackSpa = await page.request.get(`${frontendDocker}/qa-rota-inexistente`);
  expect(fallbackSpa.status(), "fallback das rotas SPA continua disponível").toBe(200);
  expect(fallbackSpa.headers()["content-type"]).toContain("text/html");

  const acesso = acessoDemo();
  const usuario = acesso.usuarios.find((item) => item.perfil === "GESTOR");
  if (!usuario) throw new Error("Conta sintética GESTOR não encontrada.");

  const csrfPendente = respostaDaApi(page, "/auth/csrf", "GET");
  const loginPendente = respostaDaApi(page, "/auth/login", "POST");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(acesso.senha);
  await page.getByRole("button", { name: "Acessar", exact: true }).click();

  const [csrf, login] = await Promise.all([csrfPendente, loginPendente]);
  expect(csrf.status(), "token CSRF emitido pela API").toBe(200);
  expect(csrf.headers()["content-type"]).toContain("application/json");
  expect(login.status(), "login processado pela API").toBe(200);
  expect(login.headers()["content-type"]).toContain("application/json");
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
});
