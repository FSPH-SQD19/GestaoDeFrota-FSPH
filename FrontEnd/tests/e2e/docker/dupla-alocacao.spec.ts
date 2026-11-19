import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://127.0.0.1:3000/api/v1";

type AcessoDemo = {
  senha: string;
  usuarios: { email: string; perfil: string }[];
};
type Veiculo = {
  id: string;
  tipoFrota: string;
  status: string;
  ativo: boolean;
  capacidadeMaxima: number;
};
type Motorista = {
  id: string;
  status: string;
  ativo: boolean;
  validadeCnh: string;
};

function acessoDemo(): AcessoDemo {
  const caminho = process.env.ROTA_QA_DEMO_ACCESS
    ? resolve(process.env.ROTA_QA_DEMO_ACCESS)
    : resolve(process.cwd(), "../BackEnd/.runtime/demo-access.json");
  return JSON.parse(readFileSync(caminho, "utf8")) as AcessoDemo;
}

async function entrarComoAdmin(page: Page) {
  const acesso = acessoDemo();
  const usuario = acesso.usuarios.find((item) => item.perfil === "ADMIN");
  if (!usuario) throw new Error("Conta sintética ADMIN não encontrada.");

  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(acesso.senha);
  await page.getByRole("button", { name: "Acessar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
}

test("ADMIN não aprova duas viagens concorrentes com o mesmo veículo e motorista", async ({
  page,
}) => {
  await entrarComoAdmin(page);

  const csrfResponse = await page.request.get(`${api}/auth/csrf`);
  expect(csrfResponse.status()).toBe(200);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const headers = { "x-csrf-token": csrfToken };

  const [veiculosResponse, motoristasResponse] = await Promise.all([
    page.request.get(
      `${api}/veiculos?page=1&pageSize=100&tipoFrota=ADMINISTRATIVA&status=DISPONIVEL`,
    ),
    page.request.get(`${api}/motoristas`),
  ]);
  expect(veiculosResponse.status()).toBe(200);
  expect(motoristasResponse.status()).toBe(200);
  const { data: veiculos } = (await veiculosResponse.json()) as { data: Veiculo[] };
  const motoristas = (await motoristasResponse.json()) as Motorista[];

  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 10);
  inicio.setHours(10, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
  const fimLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fim);
  const veiculosDisponiveis = veiculos.filter(
    (item) =>
      item.ativo &&
      item.tipoFrota === "ADMINISTRATIVA" &&
      item.status === "DISPONIVEL" &&
      item.capacidadeMaxima >= 1,
  );
  const motoristasDisponiveis = motoristas.filter(
    (item) =>
      item.ativo && item.status === "DISPONIVEL" && item.validadeCnh.slice(0, 10) >= fimLocal,
  );
  let veiculo: Veiculo | undefined;
  for (const candidato of veiculosDisponiveis) {
    const respostaDocumentos = await page.request.get(`${api}/veiculos/${candidato.id}/documentos`);
    expect(respostaDocumentos.status(), "consultar documentação da fixture").toBe(200);
    const documentos = (await respostaDocumentos.json()) as {
      data: { atual: boolean; dataVencimento: string }[];
    };
    const documentosDuranteViagem = documentos.data.filter((documento) => documento.atual);
    if (documentosDuranteViagem.every((documento) => documento.dataVencimento >= fimLocal)) {
      veiculo = candidato;
      break;
    }
  }
  const motorista = motoristasDisponiveis[0];
  console.log(
    `Fixtures elegíveis: veículos ${veiculosDisponiveis.length}; veículos com documentos válidos até o retorno ${Number(Boolean(veiculo))}; motoristas ${motoristasDisponiveis.length}; motoristas ativos ${motoristas.filter((item) => item.ativo).length}; status de motoristas ${JSON.stringify(motoristas.reduce<Record<string, number>>((contagem, item) => ({ ...contagem, [item.status]: (contagem[item.status] ?? 0) + 1 }), {}))}.`,
  );
  test.skip(
    !veiculo || !motorista,
    `Fixtures elegíveis: veículos ${veiculosDisponiveis.length}, motoristas ${motoristasDisponiveis.length}.`,
  );
  if (!veiculo || !motorista) return;

  const idsCriados: string[] = [];
  try {
    const criar = () =>
      page.request.post(`${api}/solicitacoes`, {
        headers,
        data: {
          setorOrigem: "QA concorrência",
          origem: `Origem sintética dupla alocação ${Date.now()}`,
          destino: "Destino sintético de dupla alocação",
          dataHoraPretendida: inicio.toISOString(),
          dataHoraRetornoPrevista: fim.toISOString(),
          quantidadePassageiros: 1,
          tipoTransporte: "PASSAGEIROS",
          urgencia: "NORMAL",
          justificativa: "Teste integrado sintético de concorrência de alocação.",
        },
      });
    const criacoes = await Promise.all([criar(), criar()]);
    for (const resposta of criacoes) {
      expect(resposta.status(), "criar solicitação sintética").toBe(201);
      idsCriados.push(((await resposta.json()) as { id: string }).id);
    }

    const aprovar = (id: string) =>
      page.request.patch(`${api}/solicitacoes/${id}/aprovar`, {
        headers,
        data: { veiculoId: veiculo.id, motoristaId: motorista.id },
      });
    const respostas = await Promise.all(idsCriados.map(aprovar));
    const status = respostas.map((resposta) => resposta.status());
    console.log(`Respostas HTTP das aprovações concorrentes: ${status.join(", ")}.`);

    expect(status.filter((valor) => valor === 200)).toHaveLength(1);
    expect(status.filter((valor) => valor === 409)).toHaveLength(1);

    const consulta = await page.request.get(
      `${api}/solicitacoes?page=1&pageSize=100&busca=${encodeURIComponent("Origem sintética dupla alocação")}`,
    );
    expect(consulta.status()).toBe(200);
    const registros = (await consulta.json()) as {
      data: {
        id: string;
        status: string;
        veiculoAlocadoId: string | null;
        motoristaAlocadoId: string | null;
      }[];
    };
    const fixtures = registros.data.filter((item) => idsCriados.includes(item.id));
    expect(fixtures).toHaveLength(2);
    expect(fixtures.filter((item) => item.status === "APROVADA")).toHaveLength(1);
    expect(fixtures.filter((item) => item.status === "PENDENTE")).toHaveLength(1);
    expect(fixtures.filter((item) => item.veiculoAlocadoId === veiculo.id)).toHaveLength(1);
    expect(fixtures.filter((item) => item.motoristaAlocadoId === motorista.id)).toHaveLength(1);
  } finally {
    for (const id of idsCriados) {
      const cancelamento = await page.request.patch(`${api}/solicitacoes/${id}/cancelar`, {
        headers,
        data: { motivoCancelamento: "Limpeza do teste sintético de dupla alocação." },
      });
      expect(cancelamento.status(), "limpar solicitação sintética").toBe(200);
    }
  }
});
