import { expect, test, type Page } from "@playwright/test";
import type { ChamadoSvo, MotoristaSvo, ViaturaSvo } from "../../src/services/svo";

async function sessao(page: Page, perfil: string) {
  await page.route("**/api/v1/auth/sessao", (route) =>
    route.fulfill({
      json: {
        usuario: {
          id: "pessoa-teste",
          nome: "Pessoa Teste",
          email: "teste@example.test",
          perfis: [perfil],
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
}

test("dashboard exibe os totais de toda a frota e atualiza pela consulta de resumo", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await sessao(page, "GESTOR");
  let total = 155;
  let consultas = 0;
  await page.route("**/api/v1/dashboard/resumo", (route) => {
    consultas++;
    return route.fulfill({
      json: {
        veiculos: {
          total,
          porStatus: { DISPONIVEL: total - 25, EM_VIAGEM: 20, MANUTENCAO: 5, DESINFECCAO: 0 },
        },
        alertas: [
          {
            id: "documento-teste",
            veiculoId: "veiculo-teste",
            placa: "ABC1234",
            tipoDocumento: "CRLV",
            dataVencimento: "2026-11-04",
            atual: true,
            situacao: "PROXIMO_VENCIMENTO",
            diasParaVencer: 0,
          },
        ],
        solicitacoes: {
          data: [],
          meta: {
            total: 400,
            porStatus: { PENDENTE: 25, APROVADA: 10, EM_TRANSITO: 5, CONCLUIDA: 355, RECUSADA: 5 },
          },
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("155", { exact: true })).toBeVisible();
  await expect(page.getByText("130 disponíveis")).toBeVisible();
  await expect(page.getByText("400", { exact: true })).toBeVisible();
  await expect(page.getByText("Veículo ABC1234 — CRLV")).toBeVisible();
  await expect(page.getByText("Vence hoje")).toBeVisible();
  total = 160;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByText("160", { exact: true })).toBeVisible();
  await expect(page.getByText("135 disponíveis")).toBeVisible();
  expect(consultas).toBe(2);
  expect(erros).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});

test("veículos abre alertas, repete consulta com falha e ignora documentos antigos", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await sessao(page, "GESTOR");
  await page.route("**/api/v1/dashboard/resumo", (route) =>
    route.fulfill({
      json: {
        veiculos: {
          total: 1,
          porStatus: { DISPONIVEL: 1, EM_VIAGEM: 0, MANUTENCAO: 0, DESINFECCAO: 0 },
        },
        solicitacoes: {
          data: [],
          meta: {
            total: 0,
            porStatus: { PENDENTE: 0, APROVADA: 0, EM_TRANSITO: 0, CONCLUIDA: 0, RECUSADA: 0 },
          },
        },
        alertas: [],
      },
    }),
  );
  await page.route("**/api/v1/veiculos?*", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "veiculo-teste",
            placa: "ABC1234",
            modelo: "Veículo de teste",
            tipoFrota: "ADMINISTRATIVA",
            capacidadeMaxima: 4,
            combustivel: "Flex",
            ano: 2026,
            status: "DISPONIVEL",
          },
        ],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
    }),
  );
  let consultas = 0;
  await page.route("**/api/v1/veiculos/veiculo-teste/documentos", (route) => {
    consultas++;
    if (consultas === 1)
      return route.fulfill({ status: 503, json: { message: "Falha ao consultar documentos." } });
    return route.fulfill({
      json: {
        data: [
          {
            id: "atual",
            tipoDocumento: "IPVA",
            atual: true,
            situacao: "PROXIMO_VENCIMENTO",
            diasParaVencer: 0,
          },
          {
            id: "antigo",
            tipoDocumento: "CRLV",
            atual: false,
            situacao: "VENCIDO",
            diasParaVencer: -10,
          },
          {
            id: "renovado",
            tipoDocumento: "CRLV",
            atual: true,
            situacao: "VIGENTE",
            diasParaVencer: 365,
          },
        ],
        resumo: {
          situacaoGeral: "PROXIMO_VENCIMENTO",
          bloqueiaAlocacao: false,
          tiposSemRegistro: ["SEGURO"],
        },
      },
    });
  });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Veículos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gestão da Frota de Veículos" })).toBeVisible();
  await page.getByRole("button", { name: "Ver documentos do veículo ABC1234" }).click();
  await expect(page.getByRole("alert")).toHaveText("Falha ao consultar documentos.");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByText("Vence hoje")).toBeVisible();
  await expect(page.getByText("Vencido há 10 dia(s)")).toHaveCount(0);
  await expect(page.getByText("CRLV", { exact: true })).toHaveCount(0);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("documentos-veiculo.png"), fullPage: true });
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByText("Alertas de vencimento", { exact: true })).toHaveCount(0);
  expect(consultas).toBe(2);
  expect(erros).toEqual([]);
});

for (const cancelar of [false, true]) {
  test(`SVO registra, aprova e ${cancelar ? "cancela reserva" : "percorre as etapas até a desinfecção"}`, async ({
    page,
  }, testInfo) => {
    const erros: string[] = [];
    const acoes: string[] = [];
    page.on("pageerror", (erro) => erros.push(erro.message));
    page.on("console", (mensagem) => {
      if (mensagem.type() === "error" || mensagem.type() === "warning") erros.push(mensagem.text());
    });
    await sessao(page, "SVO");
    let chamado: ChamadoSvo | null = null;
    const viatura: ViaturaSvo = {
      id: "viatura-teste",
      placa: "ABC1D23",
      modelo: "Viatura SVO",
      status: "DISPONIVEL",
      capacidadeMaxima: 4,
      ativo: true,
      ocupacaoAtual: 0,
      motoristaAtual: null,
    };
    const motorista: MotoristaSvo = {
      id: "motorista-teste",
      status: "DISPONIVEL",
      numeroCnh: "12345678901",
      categoriaCnh: "D",
      usuario: { nome: "Condutor Teste" },
    };
    await page.route("**/api/v1/svo/**", async (route) => {
      const request = route.request();
      const caminho = new URL(request.url()).pathname;
      if (request.method() !== "GET")
        expect(request.headers()["x-csrf-token"]).toBe("a".repeat(64));
      if (caminho.endsWith("/indicadores"))
        return route.fulfill({
          json: {
            total: chamado ? 1 : 0,
            emAnalise: chamado?.statusTriagem === "EM_ANALISE" ? 1 : 0,
            aguardandoOrdem: chamado?.statusTriagem === "APROVADO" && !chamado.ordemColeta ? 1 : 0,
            aprovados: chamado?.statusTriagem === "APROVADO" ? 1 : 0,
            recusados: 0,
            coletasEmAndamento: ["EM_DESLOCAMENTO", "NO_LOCAL"].includes(
              chamado?.ordemColeta?.status ?? "",
            )
              ? 1
              : 0,
            viaturasDisponiveis: viatura.status === "DISPONIVEL" ? 1 : 0,
            totalViaturas: 1,
          },
        });
      if (caminho.endsWith("/viaturas")) return route.fulfill({ json: [viatura] });
      if (caminho.endsWith("/motoristas")) return route.fulfill({ json: [motorista] });
      if (caminho.endsWith("/escalas"))
        return route.fulfill({
          json: {
            data: [
              {
                id: "escala-teste",
                motorista: {
                  id: motorista.id,
                  nome: "Condutor Teste",
                  telefone: null,
                  ativo: true,
                },
                veiculo: viatura,
                inicioTurno: "2026-11-03T07:00:00-03:00",
                fimTurno: "2026-11-03T19:00:00-03:00",
                observacoes: null,
                encerradaEm: null,
                situacao: "EM_ANDAMENTO",
              },
            ],
            meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        });
      if (caminho.endsWith("/chamados") && request.method() === "GET")
        return route.fulfill({
          json: {
            data: chamado ? [chamado] : [],
            meta: { page: 1, pageSize: 10, total: chamado ? 1 : 0, totalPages: chamado ? 1 : 0 },
          },
        });
      if (caminho.endsWith("/chamados") && request.method() === "POST") {
        acoes.push("registrar");
        chamado = {
          ...request.postDataJSON(),
          id: "chamado-teste",
          numeroProtocolo: "SVO-2026-0042",
          atendenteId: "pessoa-teste",
          statusTriagem: "EM_ANALISE",
          justificativaTriagem: null,
          ordemColeta: null,
        };
        return route.fulfill({ status: 201, json: chamado });
      }
      if (chamado && caminho.endsWith("/triagem")) {
        acoes.push("aprovar");
        expect(request.postDataJSON()).toMatchObject({
          decisao: "APROVAR",
          justificativa: "Critérios compatíveis.",
        });
        chamado.statusTriagem = "APROVADO";
        chamado.justificativaTriagem = "Critérios compatíveis.";
        return route.fulfill({ json: chamado });
      }
      if (chamado && caminho.endsWith("/ordens-coleta") && request.method() === "POST") {
        acoes.push("reservar");
        expect(request.postDataJSON()).toEqual({
          chamadoId: chamado.id,
          veiculoId: viatura.id,
          motoristaId: motorista.id,
        });
        chamado.ordemColeta = {
          id: "ordem-teste",
          chamadoId: chamado.id,
          veiculoId: viatura.id,
          motoristaId: motorista.id,
          status: "AGUARDANDO_DESPACHO",
          numeroDeclaracaoObito: null,
          dataHoraSaida: null,
          dataHoraChegadaLocal: null,
          dataHoraEntregaSvo: null,
          veiculo: viatura,
          motorista,
        };
        viatura.ocupacaoAtual = 1;
        viatura.motoristaAtual = { id: motorista.id, nome: "Condutor Teste" };
        motorista.status = "OCUPADO";
        return route.fulfill({ status: 201, json: chamado.ordemColeta });
      }
      if (
        chamado?.ordemColeta &&
        caminho === "/api/v1/svo/ordens-coleta/ordem-teste/etapa" &&
        request.method() === "PATCH"
      ) {
        const { status } = request.postDataJSON();
        const ordem = chamado.ordemColeta;
        const anteriores: Record<string, string> = {
          EM_DESLOCAMENTO: "AGUARDANDO_DESPACHO",
          NO_LOCAL: "EM_DESLOCAMENTO",
          ENTREGUE_SVO: "NO_LOCAL",
        };
        expect(ordem.status).toBe(anteriores[status]);
        acoes.push(status);
        ordem.status = status;
        if (status === "EM_DESLOCAMENTO") {
          ordem.dataHoraSaida = "2026-11-03T11:00:00Z";
          viatura.status = "EM_VIAGEM";
        } else if (status === "NO_LOCAL") ordem.dataHoraChegadaLocal = "2026-11-03T11:30:00Z";
        else {
          ordem.dataHoraEntregaSvo = "2026-11-03T12:30:00Z";
          viatura.status = "DESINFECCAO";
          viatura.ocupacaoAtual = 0;
          viatura.motoristaAtual = null;
          motorista.status = "DISPONIVEL";
        }
        return route.fulfill({ json: ordem });
      }
      if (
        chamado?.ordemColeta &&
        caminho === "/api/v1/svo/ordens-coleta/ordem-teste/cancelar" &&
        request.method() === "PATCH"
      ) {
        expect(chamado.ordemColeta.status).toBe("AGUARDANDO_DESPACHO");
        acoes.push("cancelar");
        chamado.ordemColeta.status = "CANCELADA";
        viatura.ocupacaoAtual = 0;
        viatura.motoristaAtual = null;
        motorista.status = "DISPONIVEL";
        return route.fulfill({ json: chamado.ordemColeta });
      }
      if (caminho.endsWith("/desinfeccao")) {
        acoes.push("desinfetar");
        viatura.status = "DISPONIVEL";
        return route.fulfill({ json: viatura });
      }
      throw new Error(`Requisição inesperada: ${request.method()} ${caminho}`);
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Central de operações SVO" })).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle(/Frota/i);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await expect(page.getByText("Pronto para despacho")).toBeVisible();
    await page.getByRole("button", { name: "Registrar chamado", exact: true }).click();
    await page.getByLabel(/^Nome do falecido/).fill("Pessoa atendida");
    await page.getByLabel(/^Endereço da ocorrência/).fill("Rua das Flores, 100");
    await page.getByLabel(/^Relato da ocorrência/).fill("Ocorrência informada pela família.");
    await page.getByRole("button", { name: "Salvar chamado" }).click();
    const linha = page.locator("article").filter({ hasText: "SVO-2026-0042" });
    await linha.getByRole("button", { name: "Iniciar triagem" }).click();
    await page.getByLabel("Justificativa / parecer da triagem").fill("Critérios compatíveis.");
    await page.getByRole("button", { name: "Aprovar triagem" }).click();
    await linha.getByRole("button", { name: "Emitir ordem", exact: true }).click();
    await expect(page.getByLabel(/^Viatura SVO/)).toHaveValue(viatura.id);
    await expect(page.getByLabel("Motorista habilitado")).toHaveValue(motorista.id);
    await page.getByRole("button", { name: "Emitir ordem de coleta", exact: true }).click();
    await expect(linha.getByText("Aguardando despacho", { exact: true })).toBeVisible();
    await expect(linha.getByRole("button", { name: "Registrar entrega ao SVO" })).toHaveCount(0);
    const indicador = page.getByText("Coletas em andamento", { exact: true }).locator("..");
    await expect(indicador.getByText("0", { exact: true })).toBeVisible();
    if (cancelar) {
      await linha.getByRole("button", { name: "Cancelar ordem", exact: true }).click();
      await expect(linha.getByText("Ordem cancelada", { exact: true })).toBeVisible();
      await expect(page.getByText("Liberada para nova coleta", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirmar desinfecção" })).toHaveCount(0);
      await expect(linha.getByRole("button", { name: "Registrar saída" })).toHaveCount(0);
      expect(acoes).toEqual(["registrar", "aprovar", "reservar", "cancelar"]);
    } else {
      await page.screenshot({ path: testInfo.outputPath("svo-reserva.png"), fullPage: true });
      await linha.screenshot({ path: testInfo.outputPath("svo-acoes.png") });
      await linha.getByRole("button", { name: "Registrar saída", exact: true }).click();
      await expect(linha.getByText("Em coleta", { exact: true })).toBeVisible();
      await expect(linha.getByRole("button", { name: "Cancelar ordem" })).toHaveCount(0);
      await expect(indicador.getByText("1", { exact: true })).toBeVisible();
      await linha.getByRole("button", { name: "Registrar chegada ao local", exact: true }).click();
      await expect(linha.getByText("No local da ocorrência", { exact: true })).toBeVisible();
      await linha.getByRole("button", { name: "Registrar entrega ao SVO", exact: true }).click();
      await expect(linha.getByText("Coleta concluída", { exact: true })).toBeVisible();
      await linha.getByRole("button", { name: "Ver detalhes SVO-2026-0042" }).click();
      await expect(page.getByText("03/11/2026, 08:00", { exact: true })).toBeVisible();
      await expect(page.getByText("03/11/2026, 08:30", { exact: true })).toBeVisible();
      await expect(page.getByText("03/11/2026, 09:30", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "Fechar", exact: true })
        .filter({ hasText: "Fechar" })
        .click();
      await expect(page.getByText("Em desinfecção", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Confirmar desinfecção" }).click();
      await expect(page.getByText("Liberada para nova coleta", { exact: true })).toBeVisible();
      expect(acoes).toEqual([
        "registrar",
        "aprovar",
        "reservar",
        "EM_DESLOCAMENTO",
        "NO_LOCAL",
        "ENTREGUE_SVO",
        "desinfetar",
      ]);
    }
    expect(erros).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("svo.png"), fullPage: true });
  });
}
