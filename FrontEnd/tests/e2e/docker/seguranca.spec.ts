import { expect, test, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Perfil = "ADMIN" | "GESTOR" | "MOTORISTA" | "SVO" | "SOLICITANTE";
type AcessoDemo = { senha: string; usuarios: { email: string; perfil: Perfil }[] };

const api = "http://127.0.0.1:3000/api/v1";
const relatorioViagens = "/relatorios/viagens?inicio=2026-01-01&fim=2026-12-31";

function acessosDemo(): AcessoDemo {
  const caminho = process.env.ROTA_QA_DEMO_ACCESS
    ? resolve(process.env.ROTA_QA_DEMO_ACCESS)
    : resolve(process.cwd(), "../BackEnd/.runtime/demo-access.json");
  return JSON.parse(readFileSync(caminho, "utf8")) as AcessoDemo;
}

async function sessaoDoPerfil(browser: Browser, perfil: Perfil) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
  const page = await context.newPage();
  const acessos = acessosDemo();
  const usuario = acessos.usuarios.find((item) => item.perfil === perfil);
  if (!usuario) throw new Error(`Conta sintética do perfil ${perfil} não encontrada.`);

  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(acessos.senha);
  await page.getByRole("button", { name: "Acessar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  return { context, page };
}

test("API protegida rejeita requisições sem sessão", async ({ request }) => {
  for (const rota of [
    "/auth/sessao",
    "/veiculos",
    "/solicitacoes",
    "/manutencoes",
    "/notificacoes",
    "/relatorios/viagens",
    "/svo/chamados",
  ]) {
    const response = await request.get(`${api}${rota}`);
    expect(response.status(), `sem sessão: GET ${rota}`).toBe(401);
  }
  const tokenInvalido = await request.get(`${api}/auth/sessao`, {
    headers: { authorization: "Bearer token-invalido" },
  });
  expect(tokenInvalido.status(), "token Bearer inválido").toBe(401);
});

test("RBAC da API respeita os perfis na leitura de módulos", async ({ browser }) => {
  const matriz: Record<Perfil, Record<string, number>> = {
    ADMIN: {
      "/veiculos": 200,
      "/solicitacoes": 200,
      "/manutencoes": 200,
      [relatorioViagens]: 200,
      "/svo/chamados": 200,
    },
    GESTOR: {
      "/veiculos": 200,
      "/solicitacoes": 200,
      "/manutencoes": 200,
      [relatorioViagens]: 200,
      "/svo/chamados": 403,
    },
    SOLICITANTE: {
      "/veiculos": 403,
      "/solicitacoes": 200,
      "/manutencoes": 403,
      [relatorioViagens]: 403,
      "/svo/chamados": 403,
    },
    MOTORISTA: {
      "/veiculos": 403,
      "/solicitacoes": 403,
      "/manutencoes": 403,
      [relatorioViagens]: 403,
      "/svo/chamados": 403,
    },
    SVO: {
      "/veiculos": 403,
      "/solicitacoes": 403,
      "/manutencoes": 403,
      [relatorioViagens]: 403,
      "/svo/chamados": 200,
    },
  };

  for (const [perfil, rotas] of Object.entries(matriz) as [Perfil, Record<string, number>][]) {
    const { context } = await sessaoDoPerfil(browser, perfil);
    try {
      for (const [rota, statusEsperado] of Object.entries(rotas)) {
        const response = await context.request.get(`${api}${rota}`);
        expect(response.status(), `${perfil}: GET ${rota}`).toBe(statusEsperado);
      }
      const notificacoes = await context.request.get(`${api}/notificacoes`);
      expect(notificacoes.status(), `${perfil}: GET /notificacoes`).toBe(200);
    } finally {
      await context.close();
    }
  }
});

test("SOLICITANTE só acessa as próprias solicitações e mutações protegidas exigem CSRF", async ({ browser }) => {
  const admin = await sessaoDoPerfil(browser, "ADMIN");
  const solicitante = await sessaoDoPerfil(browser, "SOLICITANTE");
  let solicitacaoAlheiaId: string | undefined;

  try {
    const [respostaSessao, respostaSolicitacoes] = await Promise.all([
      solicitante.context.request.get(`${api}/auth/sessao`),
      solicitante.context.request.get(`${api}/solicitacoes?pageSize=100`),
    ]);
    expect(respostaSessao.status()).toBe(200);
    expect(respostaSolicitacoes.status()).toBe(200);
    const sessao = (await respostaSessao.json()) as { usuario: { id: string } };
    const listaInicial = (await respostaSolicitacoes.json()) as {
      data: { solicitanteId: string }[];
    };
    expect(listaInicial.data.length).toBeGreaterThan(0);
    expect(listaInicial.data.every((item) => item.solicitanteId === sessao.usuario.id)).toBe(true);

    const csrfAdminResposta = await admin.context.request.get(`${api}/auth/csrf`);
    expect(csrfAdminResposta.status()).toBe(200);
    const csrfAdmin = (await csrfAdminResposta.json()) as { csrfToken: string };

    const saida = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const retorno = new Date(saida.getTime() + 2 * 60 * 60 * 1000);
    const criada = await admin.context.request.post(`${api}/solicitacoes`, {
      headers: { "x-csrf-token": csrfAdmin.csrfToken },
      data: {
        setorOrigem: "QA sintético",
        origem: "Origem sintética de segurança",
        destino: "Destino sintético de segurança",
        dataHoraPretendida: saida.toISOString(),
        dataHoraRetornoPrevista: retorno.toISOString(),
        quantidadePassageiros: 1,
        tipoTransporte: "PASSAGEIROS",
        urgencia: "NORMAL",
        justificativa: "Teste sintético de isolamento entre solicitantes.",
      },
    });
    expect(criada.status(), "ADMIN cria fixture sintética").toBe(201);
    solicitacaoAlheiaId = ((await criada.json()) as { id: string }).id;

    const listaSolicitante = await solicitante.context.request.get(`${api}/solicitacoes?pageSize=100`);
    expect(listaSolicitante.status()).toBe(200);
    const itens = (await listaSolicitante.json()) as {
      data: { id: string; solicitanteId: string }[];
    };
    expect(itens.data.some((item) => item.id === solicitacaoAlheiaId)).toBe(false);

    const csrfSolicitanteResposta = await solicitante.context.request.get(`${api}/auth/csrf`);
    const csrfSolicitante = (await csrfSolicitanteResposta.json()) as { csrfToken: string };
    const tentativaCancelar = await solicitante.context.request.patch(
      `${api}/solicitacoes/${solicitacaoAlheiaId}/cancelar`,
      {
        headers: { "x-csrf-token": csrfSolicitante.csrfToken },
        data: { motivoCancelamento: "Tentativa sintética de acesso cruzado." },
      },
    );
    expect(tentativaCancelar.status(), "cancelamento de solicitação alheia").toBe(403);

    const mutacaoSemCsrf = await solicitante.context.request.post(`${api}/solicitacoes`, {
      data: {},
    });
    expect(mutacaoSemCsrf.status(), "mutação autenticada sem CSRF").toBe(403);

    const csrfOrigemExterna = await solicitante.context.request.get(`${api}/auth/csrf`, {
      headers: { origin: "https://atacante.example" },
    });
    expect(csrfOrigemExterna.status(), "origem externa").toBe(403);
  } finally {
    if (solicitacaoAlheiaId) {
      const csrfAdminResposta = await admin.context.request.get(`${api}/auth/csrf`);
      const csrfAdmin = (await csrfAdminResposta.json()) as { csrfToken: string };
      const limpeza = await admin.context.request.patch(
        `${api}/solicitacoes/${solicitacaoAlheiaId}/cancelar`,
        {
          headers: { "x-csrf-token": csrfAdmin.csrfToken },
          data: { motivoCancelamento: "Limpeza da fixture sintética de segurança." },
        },
      );
      expect(limpeza.status(), "limpeza da fixture sintética").toBe(200);
    }
    await Promise.all([admin.context.close(), solicitante.context.close()]);
  }
});
