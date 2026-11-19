import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Perfil = "ADMIN" | "GESTOR" | "MOTORISTA" | "SVO" | "SOLICITANTE";
type AcessoDemo = {
  senha: string;
  usuarios: { email: string; perfil: Perfil }[];
};

function acessoDemo(): AcessoDemo {
  const caminho = process.env.ROTA_QA_DEMO_ACCESS
    ? resolve(process.env.ROTA_QA_DEMO_ACCESS)
    : resolve(process.cwd(), "../BackEnd/.runtime/demo-access.json");
  return JSON.parse(readFileSync(caminho, "utf8")) as AcessoDemo;
}

async function entrarComo(page: Page, perfil: Perfil) {
  const acesso = acessoDemo();
  const usuario = acesso.usuarios.find((item) => item.perfil === perfil);
  if (!usuario) throw new Error(`Acesso demo do perfil ${perfil} não encontrado.`);

  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(acesso.senha);
  await page.getByRole("button", { name: "Acessar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
}

function dataFutura(dias: number, hora: number, minuto = 0) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(hora, minuto, 0, 0);
  const pad = (valor: number) => String(valor).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

test("GESTOR integra frota, manutenção preventiva, notificações e relatórios com a API", async ({
  page,
}) => {
  const respostas: { path: string; status: number }[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/v1/"))
      respostas.push({ path: url.pathname, status: response.status() });
  });
  await entrarComo(page, "GESTOR");

  await page.getByRole("button", { name: "Veículos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gestão da Frota de Veículos" })).toBeVisible();
  await expect(page.getByText("DMO2A02", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Programação preventiva do veículo DMO2A02" })
    .click();
  await expect(page.getByRole("heading", { name: "Programar manutenção preventiva" })).toBeVisible();

  await page.getByLabel("Início").fill(dataFutura(20, 8));
  await page.getByLabel("Fim").fill(dataFutura(20, 9));
  await expect(page.getByText("Nenhum conflito encontrado.")).toBeVisible();
  const criarProgramacao = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/manutencoes/programacoes" &&
      response.request().method() === "POST"
    );
  });
  await page.getByRole("button", { name: "Confirmar programação" }).click();
  const respostaCriacao = await criarProgramacao;
  expect.soft(respostaCriacao.status(), "MAN-01: criar programação preventiva").toBe(201);
  if (respostaCriacao.status() === 201) {
    const programacao = (await respostaCriacao.json()) as { id: string; veiculoId: string };
    await expect(page.getByText("Manutenção programada.")).toBeVisible();

    const csrfResponse = await page.request.get("/api/v1/auth/csrf");
    expect(csrfResponse.status()).toBe(200);
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
    const headers = { "x-csrf-token": csrfToken };
    const inicio = new Date(dataFutura(20, 8)).toISOString();
    const fim = new Date(dataFutura(20, 9)).toISOString();
    const payload = { veiculoId: programacao.veiculoId, inicioPrevisto: inicio, fimPrevisto: fim };

    const janelaInvertida = await page.request.post("/api/v1/manutencoes/programacoes", {
      headers,
      data: { ...payload, inicioPrevisto: fim, fimPrevisto: inicio },
    });
    expect(janelaInvertida.status(), "MAN-01: intervalo invertido é rejeitado").toBe(400);

    const janelaConflitante = await page.request.post("/api/v1/manutencoes/programacoes", {
      headers,
      data: payload,
    });
    expect(janelaConflitante.status(), "MAN-01: sobreposição é rejeitada").toBe(409);

    const cancelarProgramacao = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === `/api/v1/manutencoes/${programacao.id}/cancelar` &&
        response.request().method() === "PATCH"
      );
    });
    await page.getByRole("button", { name: "Cancelar programação" }).click();
    expect((await cancelarProgramacao).status()).toBe(200);
    await expect(page.getByText("Programação cancelada. O período foi liberado.")).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gestão de Solicitações de Viagem" }),
  ).toBeVisible();
  await expect
    .poll(() => respostas.find((item) => item.path === "/api/v1/solicitacoes")?.status)
    .toBe(200);

  await page.getByRole("button", { name: "Notificações" }).click();
  await expect(page.getByRole("dialog", { name: "Central de notificações" })).toBeVisible();
  expect(respostas.some((item) => item.path === "/api/v1/notificacoes" && item.status === 200)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Gestor!" })).toBeVisible();
  for (const [nome, caminho] of [
    ["Consumo médio (km/L)", "/api/v1/relatorios/consumo"],
    ["Manutenções", "/api/v1/relatorios/manutencoes"],
    ["Viagens por setor", "/api/v1/relatorios/viagens"],
  ]) {
    const agregado = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === caminho && response.request().method() === "GET";
    });
    await page.getByRole("tab", { name: nome }).click();
    expect((await agregado).status()).toBe(200);
  }

  expect(
    respostas.filter(
      (item) => item.status >= 500 && item.path !== "/api/v1/manutencoes/programacoes",
    ),
  ).toEqual([]);
});

test("SOLICITANTE envia e cancela uma viagem sintética pela interface integrada", async ({ page }) => {
  const respostas: { path: string; status: number }[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/v1/"))
      respostas.push({ path: url.pathname, status: response.status() });
  });
  await entrarComo(page, "SOLICITANTE");
  await expect(page.getByRole("heading", { name: "Minhas Solicitações de Viagem" })).toBeVisible();
  await page.getByRole("button", { name: "Nova Solicitação de Viagem" }).click();

  await page.getByLabel("Setor solicitante").selectOption("LACEN");
  await page.getByPlaceholder("Ex: LACEN — Rua Campo do Brito").fill("Origem fictícia QA local");
  await page.getByPlaceholder("Ex: Hospital Regional de Itabaiana").fill("Destino fictício QA local");
  await page.getByLabel("Data e hora de saída").fill(dataFutura(3, 10));
  await page.getByLabel("Retorno previsto").fill(dataFutura(3, 12));
  await page.getByLabel("Justificativa").fill("Validação E2E sintética da solicitação.");

  const criarViagem = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/solicitacoes" && response.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Enviar Solicitação" }).click();
  const respostaCriacao = await criarViagem;
  expect(respostaCriacao.status()).toBe(201);
  const solicitacao = (await respostaCriacao.json()) as { id: string; protocolo: string };
  await expect(page.getByText(`Solicitação ${solicitacao.protocolo} enviada!`)).toBeVisible();

  await page.getByRole("button", { name: `Cancelar solicitação ${solicitacao.protocolo}` }).click();
  await page.getByLabel("Motivo do Cancelamento").fill("Encerramento do cenário E2E sintético.");
  const cancelarViagem = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/v1/solicitacoes/${solicitacao.id}/cancelar` &&
      response.request().method() === "PATCH"
    );
  });
  await page.getByRole("button", { name: "Confirmar Cancelamento" }).click();
  expect((await cancelarViagem).status()).toBe(200);
  await expect(page.getByText(/cancelada com sucesso/i)).toBeVisible();
  expect(respostas.filter((item) => item.status >= 500)).toEqual([]);
});
