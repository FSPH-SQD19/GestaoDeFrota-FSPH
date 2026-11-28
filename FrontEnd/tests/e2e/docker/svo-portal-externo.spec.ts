import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://127.0.0.1:3000/api/v1";
const portal = "/svo/solicitacoes-externas";
const interno = "/solicitacoes-externas-svo";

async function enviar(
  cliente: APIRequestContext,
  method: "POST" | "PATCH",
  rota: string,
  data: object,
  chave?: string,
) {
  const csrf = await cliente.get(`${api}/auth/csrf`);
  expect(csrf.ok()).toBe(true);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  return cliente.fetch(`${api}${rota}`, {
    method,
    data,
    headers: { "X-CSRF-Token": csrfToken, ...(chave && { "Idempotency-Key": chave }) },
  });
}

test("portal externo, complementação, aprovação idempotente e recusa SVO", async ({
  playwright,
  page,
}) => {
  const acesso = JSON.parse(
    readFileSync(
      resolve(process.env.ROTA_QA_DEMO_ACCESS ?? "../BackEnd/.runtime/demo-access.json"),
      "utf8",
    ),
  ) as {
    senha: string;
    usuarios: { email: string; perfil: string }[];
  };
  const atendente = await playwright.request.newContext();
  const gestor = await playwright.request.newContext();
  const outroExterno = await playwright.request.newContext();
  try {
    for (const [perfil, cliente] of [
      ["SVO", atendente],
      ["GESTOR", gestor],
    ] as const) {
      const conta = acesso.usuarios.find((item) => item.perfil === perfil);
      expect(conta).toBeDefined();
      expect(
        (
          await enviar(cliente, "POST", "/auth/login", { email: conta!.email, senha: acesso.senha })
        ).status(),
      ).toBe(200);
    }

    const cadastro = {
      nome: "Solicitante sintético QA",
      email: `qa-svo-${randomUUID()}@example.com`,
      senha: acesso.senha,
      telefone: "79999990000",
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portal-svo/cadastro");
    await page.getByLabel("Nome completo").fill(cadastro.nome);
    await page.getByLabel("E-mail").fill(cadastro.email);
    await page.getByLabel("Telefone com DDD").fill(cadastro.telefone);
    await page.getByLabel("Senha").fill(cadastro.senha);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("heading", { name: "Portal de atendimento SVO" })).toBeVisible();

    const abertura = {
      contatoNome: cadastro.nome,
      contatoTelefone: cadastro.telefone,
      enderecoOcorrencia: "Endereço fictício para homologação",
      relatoOcorrencia: "Relato sintético sem identificação de pessoas.",
    };
    const chave = randomUUID();
    const criada = await enviar(page.request, "POST", portal, abertura, chave);
    expect(criada.status()).toBe(201);
    const { id, protocolo } = (await criada.json()) as { id: string; protocolo: string };
    const reenviada = await enviar(page.request, "POST", portal, abertura, chave);
    expect(reenviada.status()).toBe(200);
    expect(await reenviada.json()).toMatchObject({ id, protocolo });

    const decisao = { justificativa: "Justificativa interna sintética para homologação." };
    expect((await enviar(gestor, "PATCH", `${interno}/${id}/aprovar`, decisao)).status()).toBe(409);
    for (const cliente of [page.request, atendente]) {
      expect((await enviar(cliente, "PATCH", `${interno}/${id}/aprovar`, decisao)).status()).toBe(
        403,
      );
    }
    expect(
      (
        await enviar(outroExterno, "POST", "/auth/cadastro-externo", {
          ...cadastro,
          email: `qa-svo-${randomUUID()}@example.com`,
        })
      ).status(),
    ).toBe(201);
    expect((await outroExterno.get(`${api}${portal}/${id}`)).status()).toBe(404);

    expect(
      (
        await enviar(atendente, "PATCH", `${interno}/${id}/triagem`, {
          decisao: "SOLICITAR_COMPLEMENTACAO",
          justificativa: decisao.justificativa,
        })
      ).status(),
    ).toBe(200);
    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    const item = page.locator("article").filter({ hasText: protocolo });
    await item
      .getByLabel("Informações complementares")
      .fill("Complemento sintético de homologação.");
    await expect(item).not.toContainText(decisao.justificativa);
    await item.getByRole("button", { name: "Enviar complemento" }).click();
    await expect(page.getByText("Complementação enviada para análise.")).toBeVisible();
    expect(
      (
        await enviar(atendente, "PATCH", `${interno}/${id}/triagem`, { decisao: "ENCAMINHAR" })
      ).status(),
    ).toBe(200);

    const chaveDecisao = randomUUID();
    const aprovada = await enviar(
      gestor,
      "PATCH",
      `${interno}/${id}/aprovar`,
      decisao,
      chaveDecisao,
    );
    expect(aprovada.status()).toBe(200);
    const { dados } = (await aprovada.json()) as { dados: { chamadoSvoId: string } };
    expect(dados.chamadoSvoId).toBeTruthy();
    const repetida = await enviar(
      gestor,
      "PATCH",
      `${interno}/${id}/aprovar`,
      decisao,
      chaveDecisao,
    );
    expect(repetida.status()).toBe(200);
    expect(await repetida.json()).toMatchObject({ dados: { chamadoSvoId: dados.chamadoSvoId } });
    const chamados = await atendente.get(`${api}/svo/chamados`, { params: { busca: protocolo } });
    expect(chamados.ok()).toBe(true);
    expect(await chamados.json()).toMatchObject({
      data: [
        {
          id: dados.chamadoSvoId,
          numeroProtocolo: protocolo,
          statusTriagem: "APROVADO",
          ordemColeta: null,
        },
      ],
    });
    const notificacoes = await page.request.get(`${api}/notificacoes`);
    expect(notificacoes.ok()).toBe(true);
    const alertas = (await notificacoes.json()) as {
      data: { referenciaId: string; mensagem: string }[];
    };
    const etapas = alertas.data.filter((alerta) => alerta.referenciaId === id);
    expect(etapas).toHaveLength(5);
    expect(JSON.stringify(etapas)).not.toContain(decisao.justificativa);

    const recusavel = await enviar(page.request, "POST", portal, abertura, randomUUID());
    expect(recusavel.status()).toBe(201);
    const { id: outroId } = (await recusavel.json()) as { id: string };
    expect(
      (
        await enviar(atendente, "PATCH", `${interno}/${outroId}/triagem`, {
          decisao: "RECUSAR",
          justificativa: decisao.justificativa,
        })
      ).status(),
    ).toBe(200);
    const recusada = await page.request.get(`${api}${portal}/${outroId}`);
    expect(await recusada.json()).toMatchObject({ situacao: "Não atendida" });
    expect(await recusada.text()).not.toContain(decisao.justificativa);

    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(item.getByRole("heading")).toContainText("Aprovada");
    await item.getByRole("button", { name: "Histórico do protocolo" }).click();
    await expect(item.getByRole("listitem")).toHaveCount(5);
    await expect(item).not.toContainText(abertura.relatoOcorrencia);
  } finally {
    await Promise.all([atendente.dispose(), gestor.dispose(), outroExterno.dispose()]);
  }
});
