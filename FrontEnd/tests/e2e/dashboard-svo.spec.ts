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
  total = 160;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByText("160", { exact: true })).toBeVisible();
  await expect(page.getByText("135 disponíveis")).toBeVisible();
  expect(consultas).toBe(2);
  expect(erros).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});

test("SVO registra, aprova, despacha, conclui e libera a viatura após desinfecção", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  const acoes: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
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
    if (request.method() !== "GET") expect(request.headers()["x-csrf-token"]).toBe("a".repeat(64));
    if (caminho.endsWith("/indicadores"))
      return route.fulfill({
        json: {
          total: chamado ? 1 : 0,
          emAnalise: chamado?.statusTriagem === "EM_ANALISE" ? 1 : 0,
          aguardandoOrdem: chamado?.statusTriagem === "APROVADO" && !chamado.ordemColeta ? 1 : 0,
          aprovados: chamado?.statusTriagem === "APROVADO" ? 1 : 0,
          recusados: 0,
          coletasEmAndamento: viatura.ocupacaoAtual,
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
              motorista: { id: motorista.id, nome: "Condutor Teste", telefone: null, ativo: true },
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
    if (chamado && caminho.endsWith("/ordens")) {
      acoes.push("despachar");
      expect(request.postDataJSON()).toEqual({ veiculoId: viatura.id, motoristaId: motorista.id });
      chamado.ordemColeta = {
        id: "ordem-teste",
        chamadoId: chamado.id,
        veiculoId: viatura.id,
        motoristaId: motorista.id,
        status: "EM_ANDAMENTO",
        numeroDeclaracaoObito: null,
        dataHoraSaida: "2026-11-03T11:00:00Z",
        veiculo: viatura,
        motorista,
      };
      viatura.status = "EM_VIAGEM";
      viatura.ocupacaoAtual = 1;
      viatura.motoristaAtual = { id: motorista.id, nome: "Condutor Teste" };
      motorista.status = "OCUPADO";
      return route.fulfill({ status: 201, json: chamado.ordemColeta });
    }
    if (chamado?.ordemColeta && caminho.endsWith("/concluir")) {
      acoes.push("concluir");
      chamado.ordemColeta.status = "CONCLUIDA";
      viatura.status = "DESINFECCAO";
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
  await linha.getByRole("button", { name: "Concluir coleta", exact: true }).click();
  await expect(page.getByText("Em desinfecção", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar desinfecção" }).click();
  await expect(page.getByText("Liberada para nova coleta", { exact: true })).toBeVisible();
  expect(acoes).toEqual(["registrar", "aprovar", "despachar", "concluir", "desinfetar"]);
  expect(erros).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("svo.png"), fullPage: true });
});
