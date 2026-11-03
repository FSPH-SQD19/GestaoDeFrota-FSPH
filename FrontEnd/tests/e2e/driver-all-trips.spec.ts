import { expect, test } from "@playwright/test";
import type { Saida } from "../../src/features/motorista/types";
test.use({ serviceWorkers: "block" });
test("lista unificada seleciona viagem administrativa entre todos os tipos e preserva a execução correta", async ({
  page,
}, testInfo) => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const veiculo = (n: number) => ({
    id: id(100 + n),
    placa: `ROTA000${n}`,
    modelo: "Veículo administrativo",
    odometroAtual: "1000",
  });
  const administrativas = [
    {
      id: id(1),
      protocolo: "SV-0001",
      origem: "FSPH",
      destino: "Hemose",
      tipoTransporte: "PASSAGEIROS",
      quantidadePassageiros: 3,
      veiculoAlocado: veiculo(1),
    },
    {
      id: id(2),
      protocolo: "SV-0002",
      origem: "Sede FSPH",
      destino: "Arquivo Central",
      tipoTransporte: "DOCUMENTOS_INSUMOS",
      quantidadePassageiros: 0,
      veiculoAlocado: veiculo(2),
    },
    {
      id: id(3),
      protocolo: "SV-0003",
      origem: "Hospital",
      destino: "LACEN",
      tipoTransporte: "MATERIAL_BIOLOGICO",
      quantidadePassageiros: 0,
      veiculoAlocado: veiculo(3),
    },
    {
      id: id(4),
      protocolo: "SV-0004",
      origem: "FSPH",
      destino: "Unidade de Saúde",
      tipoTransporte: "MISTO",
      quantidadePassageiros: 2,
      veiculoAlocado: veiculo(4),
    },
  ].map((t) => ({ ...t, dataHoraPretendida: "2026-11-01T08:00:00-03:00" }));
  const ordens = [
    {
      id: id(10),
      veiculo: veiculo(5),
      chamado: { enderecoOcorrencia: "Coleta São José" },
      coordenadas: null,
    },
    {
      id: id(11),
      veiculo: veiculo(5),
      chamado: { enderecoOcorrencia: "Coleta Atalaia" },
      coordenadas: null,
    },
  ];
  let ativa: Saida | null = null;
  let inicio: Record<string, unknown> | undefined;
  let senhaAlterada = false;
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
            id: id(20),
            nome: "Motorista da frota",
            email: "frota@test.invalid",
            perfis: ["MOTORISTA"],
          },
        },
      });
    if (path.endsWith("/auth/csrf")) return r.fulfill({ json: { csrfToken: "a".repeat(64) } });
    if (path.endsWith("/auth/alterar-senha")) {
      expect(r.request().method()).toBe("PATCH");
      expect(r.request().postDataJSON()).toEqual({
        senhaAtual: "SenhaAnterior123!",
        novaSenha: "NovaSenha123!",
      });
      senhaAlterada = true;
      return r.fulfill({ json: { mensagem: "Senha alterada com sucesso." } });
    }
    if (path.endsWith("/notificacoes"))
      return r.fulfill({
        json: {
          data: [
            {
              id: id(90),
              tipo: "VIAGEM_APROVADA",
              titulo: "Nova viagem aprovada",
              mensagem: "Uma viagem administrativa foi atribuída a você.",
              lida: false,
              criadoEm: new Date().toISOString(),
            },
          ],
          meta: { naoLidas: 1, retornadas: 1 },
        },
      });
    if (path.endsWith("/motorista/config")) return r.fulfill({ json: { enabled: true } });
    if (path.endsWith("/motorista/fornecedores")) return r.fulfill({ json: [] });
    if (path.endsWith("/motorista/tarefas"))
      return r.fulfill({
        json: {
          motorista: { id: id(20) },
          administrativas: ativa ? administrativas.filter((t) => t.id !== id(2)) : administrativas,
          ordens,
          ativa,
          historico: [],
          sessaoExpiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
        },
      });
    if (path.endsWith("/motorista/saidas")) {
      inicio = r.request().postDataJSON();
      ativa = {
        id: String(inicio!.id),
        motoristaId: id(20),
        veiculoId: String(inicio!.veiculoId),
        tipo: "ADMINISTRATIVA",
        status: "EM_ANDAMENTO",
        inicio: new Date().toISOString(),
        fim: null,
        kmInicial: "1000",
        kmFinal: null,
        pontos: [
          { id: "origem", nome: "Sede FSPH", coordenadas: null },
          { id: "destino", nome: "Arquivo Central", coordenadas: null },
        ],
        ordens: [],
      };
      return r.fulfill({ json: ativa });
    }
    return r.fulfill({ status: 404, json: { message: "Não encontrado" } });
  });
  await page.goto("/motorista");
  await expect(page.getByRole("heading", { name: "Hemose", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  const notificacoes = page.getByRole("dialog", { name: "Central de notificações" });
  await expect(notificacoes.getByText("Nova viagem aprovada", { exact: true })).toBeVisible();
  const bounds = await notificacoes.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("notificacoes-motorista.png") });
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await page.getByRole("button", { name: "Abrir conta", exact: true }).click();
  await page.getByRole("button", { name: "Alterar minha senha", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Minha Conta", exact: true })).toBeVisible();
  await page.getByLabel(/^Senha atual/).fill("SenhaAnterior123!");
  await page.getByLabel(/^Nova senha/).fill("NovaSenha123!");
  await page.getByLabel(/^Confirmar nova senha/).fill("NovaSenha123!");
  await page.getByRole("button", { name: "Salvar nova senha", exact: true }).click();
  await expect(page.getByText("Senha alterada com sucesso.", { exact: true })).toBeVisible();
  expect(senhaAlterada).toBe(true);
  await page.getByRole("button", { name: "Fechar", exact: true }).first().click();
  await page.getByRole("button", { name: "Viagens", exact: true }).click();
  await expect(page.getByText(/Próxima viagem · Passageiros/)).toBeVisible();
  await page.getByRole("button", { name: "Ver todas as viagens (5)", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Todas as viagens", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Selecionar viagem para/ })).toHaveCount(5);
  await dialog.getByRole("button", { name: "SVO (1)", exact: true }).click();
  await expect(dialog.getByText("2 coletas SVO", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Selecionar viagem para/ })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Administrativas (4)", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^Selecionar viagem para/ })).toHaveCount(4);
  await expect(
    dialog.getByText("Administrativa · Material biológico", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Administrativa · Transporte misto", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("todas-as-viagens.png"), fullPage: false });
  await dialog
    .getByRole("button", { name: "Selecionar viagem para Arquivo Central", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Arquivo Central", exact: true })).toBeVisible();
  await expect(page.getByText(/Viagem selecionada · Documentos e insumos/)).toBeVisible();
  await page.getByRole("button", { name: "Preparar saída", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar viagem", exact: true }).click();
  await expect(page.getByRole("button", { name: "Finalizar viagem", exact: true })).toBeVisible();
  expect(inicio).toMatchObject({ tipo: "ADMINISTRATIVA", tarefaId: id(2), veiculoId: id(102) });
  await expect(page.getByRole("button", { name: "Registrar coleta", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver percurso", exact: true }).click();
  await expect(page.getByText("Origem da viagem", { exact: true })).toBeVisible();
  await expect(page.getByText("Destino da viagem", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
