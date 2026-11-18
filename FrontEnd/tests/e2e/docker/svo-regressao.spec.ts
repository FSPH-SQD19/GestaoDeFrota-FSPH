import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://127.0.0.1:3000/api/v1";
const perfisSvo = ["SVO"] as const;
type AcessoDemo = { senha: string; usuarios: { email: string; perfil: string }[] };
type Viatura = {
  id: string;
  status: string;
  capacidadeMaxima: number;
  ocupacaoAtual: number;
};
type Motorista = { id: string; status: string };
type Chamado = {
  id: string;
  numeroProtocolo: string;
  statusTriagem: string;
  nomeFalecido?: string;
};
type Ordem = { id: string; chamadoId: string; status: string };

function acessoDemo(): AcessoDemo {
  const caminho = process.env.ROTA_QA_DEMO_ACCESS
    ? resolve(process.env.ROTA_QA_DEMO_ACCESS)
    : resolve(process.cwd(), "../BackEnd/.runtime/demo-access.json");
  return JSON.parse(readFileSync(caminho, "utf8")) as AcessoDemo;
}

async function entrarComoSvo(page: Page) {
  const acesso = acessoDemo();
  const usuario = acesso.usuarios.find((item) => item.perfil === perfisSvo[0]);
  if (!usuario) throw new Error("Conta sintética do perfil SVO não encontrada.");

  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(acesso.senha);
  await page.getByRole("button", { name: "Acessar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  await page.getByRole("button", { name: "Módulo SVO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Central de operações SVO" })).toBeVisible();
}

async function mutacao(page: Page, metodo: "post" | "patch", caminho: string, dados?: unknown) {
  const csrfResponse = await page.request.get(`${api}/auth/csrf`);
  expect(csrfResponse.status(), "obter CSRF para mutação SVO").toBe(200);
  const csrf = (await csrfResponse.json()) as { csrfToken: string };
  return page.request[metodo](`${api}${caminho}`, {
    headers: { "x-csrf-token": csrf.csrfToken },
    ...(dados === undefined ? {} : { data: dados }),
  });
}

async function criarChamadoAprovado(page: Page, sufixo: string): Promise<Chamado> {
  const chamadoResponse = await mutacao(page, "post", "/svo/chamados", {
    nomeFalecido: `Pessoa sintética QA ${sufixo}`,
    enderecoOcorrencia: `Local fictício QA ${sufixo}`,
    relatoOcorrencia: "Registro sintético para validação operacional do SVO.",
  });
  expect(chamadoResponse.status(), "registrar chamado sintético").toBe(201);
  const chamado = (await chamadoResponse.json()) as Chamado;

  const triagem = await mutacao(page, "patch", `/svo/chamados/${chamado.id}/triagem`, {
    decisao: "APROVAR",
    justificativa: "Critérios operacionais sintéticos para QA.",
  });
  expect(triagem.status(), "aprovar chamado sintético").toBe(200);
  return chamado;
}

async function inventario(page: Page) {
  const [viaturasResponse, motoristasResponse] = await Promise.all([
    page.request.get(`${api}/svo/viaturas`),
    page.request.get(`${api}/svo/motoristas`),
  ]);
  expect(viaturasResponse.status()).toBe(200);
  expect(motoristasResponse.status()).toBe(200);
  return {
    viaturas: (await viaturasResponse.json()) as Viatura[],
    motoristas: (await motoristasResponse.json()) as Motorista[],
  };
}

async function limparChamadosSinteticosPendentes(page: Page) {
  const filtro = new URLSearchParams({ busca: "Pessoa sintética QA", pageSize: "100" });
  const resposta = await page.request.get(`${api}/svo/chamados?${filtro}`);
  expect(resposta.status(), "consultar fixtures SVO sintéticas").toBe(200);
  const chamados = (await resposta.json()) as { data: Chamado[] };
  for (const chamado of chamados.data) {
    if (
      chamado.nomeFalecido?.startsWith("Pessoa sintética QA") &&
      chamado.statusTriagem === "EM_ANALISE"
    ) {
      const limpeza = await mutacao(page, "patch", `/svo/chamados/${chamado.id}/triagem`, {
        decisao: "RECUSAR",
        justificativa: "Limpeza de fixture sintética QA local.",
      });
      expect(limpeza.status(), "encerrar chamado sintético pendente anterior").toBe(200);
    }
  }
}

test("SVO recebe ligação telefônica sintética e bloqueia triagem inválida", async ({ page }) => {
  const sufixo = Date.now().toString();
  const nomeSintetico = `Pessoa sintética QA ${sufixo}`;
  await entrarComoSvo(page);
  await limparChamadosSinteticosPendentes(page);

  await page.getByRole("button", { name: "Registrar chamado", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Registrar chamado SVO" })).toBeVisible();
  await page.getByPlaceholder("Nome completo informado no atendimento").fill(nomeSintetico);
  await page
    .getByPlaceholder("Rua, número, bairro e município")
    .fill(`Local fictício QA ${sufixo}`);
  await page
    .getByPlaceholder(
      "Registre as circunstâncias do óbito, telefone de retorno e informações da ligação.",
    )
    .fill("Ligação fictícia para teste automatizado, sem pessoa ou ocorrência real.");

  const respostaCriacaoPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/svo/chamados" && response.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Salvar chamado", exact: true }).click();
  const respostaCriacao = await respostaCriacaoPromise;
  expect(respostaCriacao.status()).toBe(201);
  const chamado = (await respostaCriacao.json()) as Chamado;
  await expect(
    page
      .locator('[role="status"]')
      .filter({ hasText: "registrado com sucesso e incluído na fila" }),
  ).toBeVisible();
  await expect(page.locator("article").filter({ hasText: nomeSintetico })).toBeVisible();

  const payloadInvalido = await mutacao(page, "post", "/svo/chamados", {});
  expect(payloadInvalido.status(), "payload incompleto de chamada telefônica").toBe(400);

  const recusaSemJustificativa = await mutacao(
    page,
    "patch",
    `/svo/chamados/${chamado.id}/triagem`,
    { decisao: "RECUSAR" },
  );
  expect(recusaSemJustificativa.status(), "recusa sanitária sem parecer").toBe(400);

  const recusaValida = await mutacao(page, "patch", `/svo/chamados/${chamado.id}/triagem`, {
    decisao: "RECUSAR",
    justificativa: "Triagem sintética rejeitada no teste QA.",
  });
  expect(recusaValida.status()).toBe(200);
  expect(((await recusaValida.json()) as Chamado).statusTriagem).toBe("RECUSADO");
});

test("SVO limita capacidade concorrente e não deixa despacho parcial", async ({ page }) => {
  await entrarComoSvo(page);
  const { viaturas, motoristas } = await inventario(page);
  const viatura = viaturas.find(
    (item) =>
      item.status === "DISPONIVEL" &&
      item.ocupacaoAtual === 0 &&
      item.capacidadeMaxima >= 1 &&
      item.capacidadeMaxima <= 10,
  );
  const motorista = motoristas.find((item) => item.status === "DISPONIVEL");
  test.skip(!viatura || !motorista, "Fixture local sem viatura vazia e motorista SVO disponíveis.");
  if (!viatura || !motorista) return;

  const ordensCriadas: Ordem[] = [];
  try {
    for (let indice = 0; indice < viatura.capacidadeMaxima - 1; indice += 1) {
      const chamado = await criarChamadoAprovado(page, `cap-${Date.now()}-${indice}`);
      const resposta = await mutacao(page, "post", "/svo/ordens-coleta", {
        chamadoId: chamado.id,
        veiculoId: viatura.id,
        motoristaId: motorista.id,
      });
      expect(resposta.status(), "reserva até uma vaga antes do limite").toBe(201);
      ordensCriadas.push((await resposta.json()) as Ordem);
    }

    const [chamadoA, chamadoB] = await Promise.all([
      criarChamadoAprovado(page, `disputa-a-${Date.now()}`),
      criarChamadoAprovado(page, `disputa-b-${Date.now()}`),
    ]);
    const [respostaA, respostaB] = await Promise.all([
      mutacao(page, "post", "/svo/ordens-coleta", {
        chamadoId: chamadoA.id,
        veiculoId: viatura.id,
        motoristaId: motorista.id,
      }),
      mutacao(page, "post", "/svo/ordens-coleta", {
        chamadoId: chamadoB.id,
        veiculoId: viatura.id,
        motoristaId: motorista.id,
      }),
    ]);
    const statusConcorrentes = [respostaA.status(), respostaB.status()];
    expect(statusConcorrentes.filter((status) => status === 201)).toHaveLength(1);
    expect(statusConcorrentes.filter((status) => status === 409 || status === 422)).toHaveLength(1);
    for (const resposta of [respostaA, respostaB]) {
      if (resposta.status() === 201) ordensCriadas.push((await resposta.json()) as Ordem);
    }

    const inventarioAtualizado = await inventario(page);
    const viaturaAtualizada = inventarioAtualizado.viaturas.find((item) => item.id === viatura.id);
    expect(viaturaAtualizada?.ocupacaoAtual).toBe(viatura.capacidadeMaxima);
  } finally {
    for (const ordem of ordensCriadas) {
      const cancelamento = await mutacao(page, "patch", `/svo/ordens-coleta/${ordem.id}/cancelar`);
      expect(cancelamento.status(), "limpeza da reserva sintética").toBe(200);
    }
  }
});

test("SVO valida despacho, etapas da coleta e bloqueio sanitário até desinfecção", async ({
  page,
}) => {
  await entrarComoSvo(page);
  const { viaturas, motoristas } = await inventario(page);
  const viatura = viaturas.find(
    (item) =>
      item.status === "DISPONIVEL" && item.ocupacaoAtual === 0 && item.capacidadeMaxima >= 1,
  );
  const motorista = motoristas.find((item) => item.status === "DISPONIVEL");
  test.skip(!viatura || !motorista, "Fixture local sem viatura vazia e motorista SVO disponíveis.");
  if (!viatura || !motorista) return;

  const chamado = await criarChamadoAprovado(page, `despacho-${Date.now()}`);
  const ordemResponse = await mutacao(page, "post", "/svo/ordens-coleta", {
    chamadoId: chamado.id,
    veiculoId: viatura.id,
    motoristaId: motorista.id,
  });
  expect(ordemResponse.status()).toBe(201);
  const ordem = (await ordemResponse.json()) as Ordem;

  const etapaForaDeOrdem = await mutacao(page, "patch", `/svo/ordens-coleta/${ordem.id}/etapa`, {
    status: "ENTREGUE_SVO",
  });
  expect(etapaForaDeOrdem.status()).toBe(409);

  for (const etapa of ["EM_DESLOCAMENTO", "NO_LOCAL", "ENTREGUE_SVO"]) {
    const resposta = await mutacao(page, "patch", `/svo/ordens-coleta/${ordem.id}/etapa`, {
      status: etapa,
    });
    expect(resposta.status(), `etapa ${etapa}`).toBe(200);
    expect(((await resposta.json()) as Ordem).status).toBe(etapa);
  }

  const inventarioDesinfeccao = await inventario(page);
  expect(inventarioDesinfeccao.viaturas.find((item) => item.id === viatura.id)?.status).toBe(
    "DESINFECCAO",
  );
  const chamadoBloqueado = await criarChamadoAprovado(page, `bloqueio-${Date.now()}`);
  const despachoDuranteDesinfeccao = await mutacao(page, "post", "/svo/ordens-coleta", {
    chamadoId: chamadoBloqueado.id,
    veiculoId: viatura.id,
    motoristaId: motorista.id,
  });
  expect(despachoDuranteDesinfeccao.status()).toBe(422);

  const liberar = await mutacao(page, "patch", `/svo/viaturas/${viatura.id}/desinfeccao`);
  expect(liberar.status()).toBe(200);
  expect(((await liberar.json()) as Viatura).status).toBe("DISPONIVEL");
  const repetirLiberacao = await mutacao(page, "patch", `/svo/viaturas/${viatura.id}/desinfeccao`);
  expect(repetirLiberacao.status()).toBe(409);
});
