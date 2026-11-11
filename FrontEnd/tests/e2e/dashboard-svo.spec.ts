import { expect, test, type Page } from "@playwright/test";
import type { ChamadoSvo, MotoristaSvo, ViaturaSvo } from "../../src/services/svo";

async function sessao(page: Page, perfil: string, aguardarSessao?: Promise<void>) {
  await page.route("**/api/v1/auth/sessao", async (route) => {
    await aguardarSessao;
    return route.fulfill({
      json: {
        usuario: {
          id: "pessoa-teste",
          nome: "Pessoa Teste",
          email: "teste@example.test",
          perfis: [perfil],
        },
      },
    });
  });
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
          totalGeral: total,
          porStatus: {
            DISPONIVEL: total - 25,
            EM_VIAGEM: 20,
            MANUTENCAO: 5,
            DESINFECCAO: 0,
            INATIVO: 0,
          },
          porTipoFrota: {
            ADMINISTRATIVA: {
              total,
              totalGeral: total,
              porStatus: {
                DISPONIVEL: total - 25,
                EM_VIAGEM: 20,
                MANUTENCAO: 5,
                DESINFECCAO: 0,
                INATIVO: 0,
              },
            },
            SVO: {
              total: 0,
              totalGeral: 0,
              porStatus: {
                DISPONIVEL: 0,
                EM_VIAGEM: 0,
                MANUTENCAO: 0,
                DESINFECCAO: 0,
                INATIVO: 0,
              },
            },
          },
        },
        viagensDoDia: 3,
        alertasOperacionais: {
          total: 1,
          cnh: [],
          documentos: [
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
        },
        solicitacoes: {
          data: [],
          meta: {
            total: 400,
            porStatus: {
              PENDENTE: 25,
              APROVADA: 10,
              EM_TRANSITO: 5,
              CONCLUIDA: 350,
              RECUSADA: 5,
              CANCELADA: 5,
            },
          },
        },
        svo: {
          chamadosAtivos: 4,
          slaMedioRespostaMinutos: 18,
          slaMedioEntregaMinutos: 45,
        },
        relatorioMes: {
          kmRodados: 100,
          consumoEstimadoLitros: 10,
          veiculos: [
            {
              id: "v1",
              codigo: "XYZ1234",
              descricao: "Veículo de teste",
              kmRodados: 100,
              consumoLitros: 10,
              destaque: false,
            },
          ],
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("155", { exact: true })).toBeVisible();
  await expect(page.getByText("130", { exact: true })).toBeVisible();
  await expect(page.getByText("400", { exact: true })).toBeVisible();
  await expect(page.getByText("Veículo ABC1234 — CRLV")).toBeVisible();
  await expect(page.getByText("Vence hoje")).toBeVisible();
  await expect(page.getByText("SLA médio de resposta")).toBeVisible();
  await expect(page.getByText("18 min", { exact: true })).toBeVisible();
  await expect(page.getByText("SLA médio de entrega")).toBeVisible();
  await expect(page.getByText("45 min", { exact: true })).toBeVisible();
  await expect(page.getByText("Canceladas", { exact: true })).toBeVisible();
  await expect(page.getByText("XYZ1234", { exact: true })).toBeVisible();
  await expect(page.getByText("Estimativa: 10 km/L")).toBeVisible();
  total = 160;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByText("160", { exact: true })).toBeVisible();
  await expect(page.getByText("135", { exact: true })).toBeVisible();
  expect(consultas).toBe(2);
  expect(erros).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});

test("veículos abre alertas, repete consulta com falha e ignora documentos antigos", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  let liberarSessao!: () => void;
  const sessaoLiberada = new Promise<void>((resolve) => {
    liberarSessao = resolve;
  });
  await sessao(page, "GESTOR", sessaoLiberada);
  await page.route("**/api/v1/dashboard/resumo", (route) =>
    route.fulfill({
      json: {
        veiculos: {
          total: 1,
          totalGeral: 1,
          porStatus: {
            DISPONIVEL: 1,
            EM_VIAGEM: 0,
            MANUTENCAO: 0,
            DESINFECCAO: 0,
            INATIVO: 0,
          },
          porTipoFrota: {
            ADMINISTRATIVA: {
              total: 1,
              totalGeral: 1,
              porStatus: {
                DISPONIVEL: 1,
                EM_VIAGEM: 0,
                MANUTENCAO: 0,
                DESINFECCAO: 0,
                INATIVO: 0,
              },
            },
            SVO: {
              total: 0,
              totalGeral: 0,
              porStatus: {
                DISPONIVEL: 0,
                EM_VIAGEM: 0,
                MANUTENCAO: 0,
                DESINFECCAO: 0,
                INATIVO: 0,
              },
            },
          },
        },
        viagensDoDia: 0,
        svo: { chamadosAtivos: 0, slaMedioRespostaMinutos: null },
        solicitacoes: {
          data: [],
          meta: {
            total: 0,
            porStatus: { PENDENTE: 0, APROVADA: 0, EM_TRANSITO: 0, CONCLUIDA: 0, RECUSADA: 0 },
          },
        },
        alertasOperacionais: { total: 0, cnh: [], documentos: [] },
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
            propriedade: "PROPRIO",
            fornecedorId: null,
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
  await page.route("**/api/v1/sedes", (route) => route.fulfill({ json: { data: [] } }));
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
            dataVencimento: "2026-11-08",
            atual: true,
            situacao: "PROXIMO_VENCIMENTO",
            diasParaVencer: 0,
          },
          {
            id: "antigo",
            tipoDocumento: "CRLV",
            dataVencimento: "2026-10-01",
            atual: false,
            situacao: "VENCIDO",
            diasParaVencer: -10,
          },
          {
            id: "renovado",
            tipoDocumento: "CRLV",
            dataVencimento: "2027-11-08",
            atual: true,
            situacao: "VIGENTE",
            diasParaVencer: 365,
          },
        ],
        resumo: {
          situacaoGeral: "PROXIMO_VENCIMENTO",
          bloqueiaAlocacao: false,
          tiposSemRegistro: ["SEGURO", "VISTORIA"],
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Carregando sistema FSPH...")).toBeVisible();
  liberarSessao();
  // A consulta de visibilidade só é válida depois que o layout autenticado foi montado.
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Veículos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gestão da Frota de Veículos" })).toBeVisible();
  await expect(page.getByText("Próprio", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("table").getByText("Sede não informada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver documentos do veículo ABC1234" }).click();
  await expect(page.getByRole("alert")).toHaveText("Falha ao consultar documentos.");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByText("Documentos atuais")).toBeVisible();
  await expect(page.getByText("Vence hoje")).toBeVisible();
  await expect(page.getByText("Vencido há 10 dia(s)")).toHaveCount(0);
  await expect(page.getByText("Cadastrar ou renovar")).toBeVisible();
  await expect(page.getByText("Sem registro: Seguro, Vistoria")).toBeVisible();
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
            tempoMedioChegadaLocalMinutos: 22,
            tempoMedioEntregaSvoMinutos: 54,
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
    await expect(page.getByText("Tempo médio até o local")).toBeVisible();
    await expect(page.getByText("22 min", { exact: true })).toBeVisible();
    await expect(page.getByText("54 min", { exact: true })).toBeVisible();
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

test("motorista vê coletas SVO atribuídas e avança a etapa no celular", async ({
  page,
}, testInfo) => {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await sessao(page, "MOTORISTA");
  const ordem = {
    id: "ordem-motorista",
    chamadoId: "chamado-motorista",
    veiculoId: "viatura-svo",
    motoristaId: "motorista-logado",
    status: "AGUARDANDO_DESPACHO",
    numeroDeclaracaoObito: null,
    dataHoraSaida: null,
    dataHoraChegadaLocal: null,
    dataHoraEntregaSvo: null,
    veiculo: {
      id: "viatura-svo",
      placa: "QMA4J28",
      modelo: "S10 SVO",
      status: "DISPONIVEL",
      capacidadeMaxima: 4,
    },
    chamado: {
      id: "chamado-motorista",
      numeroProtocolo: "SVO-2026-0009",
      nomeFalecido: "Pessoa atendida",
      enderecoOcorrencia: "Rua das Flores, 100",
      criadoEm: "2026-11-10T12:00:00.000Z",
      statusTriagem: "APROVADO",
    },
  };
  await page.route("**/api/v1/svo/ordens-coleta/minhas?*", (route) => {
    const ativas = ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO", "EM_DESLOCAMENTO", "NO_LOCAL"];
    const data = ativas.includes(ordem.status) ? [ordem] : [];
    return route.fulfill({
      json: { data, meta: { page: 1, pageSize: 100, total: data.length, totalPages: 1 } },
    });
  });
  await page.route("**/api/v1/svo/ordens-coleta/ordem-motorista/etapa", (route) => {
    const { status } = route.request().postDataJSON() as { status: string };
    ordem.status = status;
    return route.fulfill({ json: ordem });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Abrir menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole("button", { name: "Coletas SVO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coletas SVO" })).toBeVisible();
  await expect(page.getByText("SVO-2026-0009")).toBeVisible();
  await page.getByRole("button", { name: "Registrar saída", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Etapa da coleta SVO-2026-0009");
  await page.getByRole("button", { name: "Registrar chegada ao local", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Registrar entrega ao SVO", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Registrar entrega ao SVO", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Coleta SVO-2026-0009 entregue" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma coleta SVO ativa atribuída a você.")).toBeVisible();
  expect(erros).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("coletas-svo-motorista.png"), fullPage: true });
});

test("gestor reagenda viagem e troca recursos com motivo", async ({ page }) => {
  await sessao(page, "GESTOR");
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  const viagem = {
    id: "11111111-1111-4111-8111-111111111111",
    protocolo: "SV-TESTE-94",
    solicitanteNome: "Pessoa Teste",
    setorOrigem: "LACEN",
    origem: "Sede",
    destino: "Hospital",
    dataHoraPretendida: "2027-01-10T11:00:00Z",
    dataHoraRetornoPrevista: "2027-01-10T15:00:00Z",
    quantidadePassageiros: 2,
    tipoTransporte: "PASSAGEIROS",
    urgencia: "NORMAL",
    justificativa: "Transporte institucional",
    status: "APROVADA",
    criadoEm: "2026-11-10T12:00:00Z",
    veiculoAlocadoId: "v1",
    motoristaAlocadoId: "m1",
    veiculoAlocado: { placa: "ABC1234", modelo: "A" },
    motoristaAlocado: { nome: "Motorista atual" },
  };
  const porStatus = {
    PENDENTE: 0,
    APROVADA: 1,
    EM_TRANSITO: 0,
    CONCLUIDA: 0,
    RECUSADA: 0,
    CANCELADA: 0,
  };
  await page.route("**/api/v1/dashboard/resumo", (route) =>
    route.fulfill({
      json: {
        veiculos: { total: 0, porStatus: {}, totalGeral: 0, porTipoFrota: {} },
        solicitacoes: { data: [], meta: { total: 0, porStatus } },
        alertas: [],
        alertasOperacionais: { total: 0, cnh: [], documentos: [] },
        viagensDoDia: 0,
        solicitacoesPendentes: 0,
        svo: { chamadosAtivos: 0, slaMedioRespostaMinutos: null, slaMedioEntregaMinutos: null },
      },
    }),
  );
  await page.route("**/api/v1/solicitacoes?*", (route) =>
    route.fulfill({
      json: { data: [viagem], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, porStatus } },
    }),
  );
  await page.route("**/api/v1/veiculos?*", (route) =>
    route.fulfill({
      json: {
        data: [
          { id: "v1", placa: "ABC1234", modelo: "A", capacidadeMaxima: 4 },
          { id: "v2", placa: "DEF1234", modelo: "B", capacidadeMaxima: 4 },
        ],
        meta: { totalPages: 1 },
      },
    }),
  );
  await page.route("**/api/v1/motoristas", (route) =>
    route.fulfill({
      json: [
        { id: "m1", ativo: true, status: "DISPONIVEL", usuario: { nome: "Motorista atual" } },
        { id: "m2", ativo: true, status: "DISPONIVEL", usuario: { nome: "Novo motorista" } },
      ],
    }),
  );
  let corpo: unknown;
  await page.route(`**/api/v1/solicitacoes/${viagem.id}/reagendar`, (route) => {
    corpo = route.request().postDataJSON();
    return route.fulfill({ json: viagem });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Olá, Pessoa Teste!" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await page.getByRole("button", { name: `Reagendar viagem ${viagem.protocolo}` }).click();
  await page.getByRole("combobox", { name: /Veículo/ }).selectOption("v2");
  await page.getByRole("combobox", { name: /Motorista/ }).selectOption("m2");
  await page.getByLabel(/Motivo da alteração/).fill("Troca de equipe");
  await page.getByRole("button", { name: "Confirmar reagendamento" }).click();
  await expect(page.getByText("Viagem reagendada.")).toBeVisible();
  expect(corpo).toMatchObject({
    veiculoId: "v2",
    motoristaId: "m2",
    motivo: "Troca de equipe",
    inicio: "2027-01-10T11:00:00.000Z",
    fim: "2027-01-10T15:00:00.000Z",
  });
  expect(erros).toEqual([]);
});
