import { expect, test } from "@playwright/test";
import type { SolicitacaoViagem } from "../../src/types/solicitacao";

test("motorista inicia e conclui a viagem pelos endpoints de solicitações", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  const viagem: SolicitacaoViagem = {
    id: "11111111-1111-4111-8111-111111111111",
    protocolo: "SV-2026-0042",
    solicitanteNome: "Equipe Hemose",
    setorOrigem: "Hemose",
    origem: "Hemose — Aracaju",
    destino: "LACEN — Unidade Central",
    dataHoraPretendida: "2026-11-03T08:30:00-03:00",
    quantidadePassageiros: 2,
    tipoTransporte: "PASSAGEIROS",
    urgencia: "NORMAL",
    justificativa: "Transporte institucional.",
    status: "APROVADA",
    criadoEm: "2026-11-01T10:00:00-03:00",
    veiculoAlocado: { placa: "QKN-2A34", modelo: "Fiat Argo", odometroAtual: "42510" },
    motoristaAlocado: { nome: "Motorista Teste" },
    execucao: null,
  };
  const chamadas: string[] = [];
  let rejeitarInicio = true;
  await page.route("**/api/v1/auth/sessao", (route) =>
    route.fulfill({
      json: {
        usuario: {
          id: "motorista-teste",
          nome: "Motorista Teste",
          email: "motorista@example.test",
          perfis: ["MOTORISTA"],
        },
      },
    }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "a".repeat(64) } }),
  );
  await page.route("**/api/v1/notificacoes?*", (route) =>
    route.fulfill({ json: { data: [], meta: { naoLidas: 0, retornadas: 0 } } }),
  );
  await page.route("**/api/v1/solicitacoes/minhas?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("20");
    const data =
      viagem.status !== "EM_TRANSITO" &&
      (!params.get("status") || params.get("status") === viagem.status)
        ? [viagem]
        : [];
    return route.fulfill({
      json: {
        data,
        viagemEmAndamento: viagem.status === "EM_TRANSITO" ? viagem : null,
        meta: { page: 1, pageSize: 20, total: data.length, totalPages: data.length },
      },
    });
  });
  await page.route(`**/api/v1/solicitacoes/${viagem.id}/*`, async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["x-csrf-token"]).toBe("a".repeat(64));
    const inicio = request.url().endsWith("/iniciar");
    const dados = request.postDataJSON();
    expect(dados).toMatchObject(
      inicio
        ? { kmInicial: 42510, checklistSaida: { pneus: true, documentos: true } }
        : { kmFinal: 42542.5, checklistRetorno: { semOcorrencias: true } },
    );
    expect((dados.checklistSaida ?? dados.checklistRetorno).fotoOdometro).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    if (inicio && rejeitarInicio) {
      rejeitarInicio = false;
      await route.fulfill({ status: 409, json: { error: "Motorista indisponível." } });
      return;
    }
    chamadas.push(inicio ? "iniciar" : "concluir");
    viagem.status = inicio ? "EM_TRANSITO" : "CONCLUIDA";
    viagem.execucao = {
      kmInicial: "42510",
      dataHoraInicio: "2026-11-03T11:30:00Z",
      ...(inicio ? {} : { kmFinal: "42542.5", dataHoraFim: "2026-11-03T12:30:00Z" }),
    };
    await route.fulfill({
      status: inicio ? 201 : 200,
      json: { ...viagem.execucao, solicitacaoId: viagem.id, status: viagem.status },
    });
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/Rota.*FSPH/);
  await expect(page.getByRole("heading", { name: "Minhas viagens" })).toBeVisible();
  await expect(page.getByRole("heading", { name: viagem.protocolo, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Iniciar viagem" }).click();
  const foto = {
    name: "odometro.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await page.getByLabel(/Foto do painel do odômetro/i).setInputFiles(foto);
  await expect(page.getByText("Foto anexada")).toBeVisible();
  await expect(page.getByLabel(/Odômetro inicial/)).toHaveValue("42510");
  await page.getByRole("button", { name: "Confirmar vistoria e iniciar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Motorista indisponível.");
  await expect(page.getByText("Foto anexada")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar vistoria e iniciar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Viagem em andamento" })).toBeVisible();

  // Restaura a execução persistida pelo servidor ao reabrir a página.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Viagem em andamento" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("viagem-em-andamento.png") });
  await page.getByRole("button", { name: "Retomar checklist" }).click();
  await expect(page.getByRole("heading", { name: "Checklist de Retorno da Viagem" })).toBeVisible();
  await page.getByLabel(/Odômetro final/).fill("42542,5");
  await page.getByLabel(/Foto do painel do odômetro/i).setInputFiles(foto);
  await expect(page.getByText("Foto anexada")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar vistoria e concluir" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Viagem em andamento" })).toHaveCount(0);
  await page.getByRole("button", { name: "Concluídas", exact: true }).click();
  await expect(page.getByRole("heading", { name: viagem.protocolo, exact: true })).toBeVisible();
  await expect(page.getByText("Concluída", { exact: true })).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(chamadas).toEqual(["iniciar", "concluir"]);
  expect(erros).toEqual([]);
});
