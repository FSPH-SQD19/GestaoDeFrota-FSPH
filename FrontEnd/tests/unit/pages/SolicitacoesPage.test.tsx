import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { SolicitacoesPage } from "../../../src/pages/solicitacoes/SolicitacoesPage";
import type { SolicitacaoViagem } from "../../../src/types/solicitacao";

const SOLICITACOES_INICIAIS: SolicitacaoViagem[] = [
  {
    id: "sol-01",
    protocolo: "SV-2026-0142",
    solicitanteNome: "Marina Costa",
    setorOrigem: "LACEN",
    origem: "LACEN — Rua Campo do Brito, 551 (Aracaju)",
    destino: "Hospital Regional de Itabaiana",
    dataHoraPretendida: "2026-10-20T08:30:00.000Z",
    dataHoraRetornoPrevista: "2026-10-20T14:00:00.000Z",
    quantidadePassageiros: 2,
    tipoTransporte: "MATERIAL_BIOLOGICO",
    urgencia: "URGENTE",
    justificativa: "Recolhimento de amostras de vigilância epidemiológica com janela térmica.",
    observacoes: "Levar caixa térmica validada.",
    status: "PENDENTE",
    criadoEm: "2026-10-16T11:20:00.000Z",
  },
  {
    id: "sol-02",
    protocolo: "SV-2026-0137",
    solicitanteNome: "Marina Costa",
    setorOrigem: "Hemose",
    origem: "Sede FSPH — Aracaju",
    destino: "Hemose — Captação Externa (Lagarto)",
    dataHoraPretendida: "2026-10-18T07:00:00.000Z",
    dataHoraRetornoPrevista: "2026-10-18T17:30:00.000Z",
    quantidadePassageiros: 4,
    tipoTransporte: "MISTO",
    urgencia: "NORMAL",
    justificativa: "Transporte da equipe técnica e insumos para campanha de doação.",
    status: "APROVADA",
    criadoEm: "2026-10-14T15:05:00.000Z",
    veiculoAlocado: { placa: "BRA-2E19", modelo: "Chevrolet Spin 1.8" },
    motoristaAlocado: { nome: "Carlos Alberto" },
  },
  {
    id: "sol-03",
    protocolo: "SV-2026-0098",
    solicitanteNome: "Marina Costa",
    setorOrigem: "LACEN",
    origem: "LACEN — Aracaju",
    destino: "Hospital Regional de Glória",
    dataHoraPretendida: "2026-10-08T06:30:00.000Z",
    quantidadePassageiros: 2,
    tipoTransporte: "MATERIAL_BIOLOGICO",
    urgencia: "NORMAL",
    justificativa: "Coleta complementar de sorologia.",
    status: "RECUSADA",
    criadoEm: "2026-10-06T16:10:00.000Z",
    motivoRecusa:
      "Indisponibilidade de veículo administrativo no horário solicitado; reagendar para o turno da tarde.",
  },
];

const VEICULOS_DISPONIVEIS = [
  {
    id: "veic-01",
    placa: "QMA-4821",
    modelo: "Fiat Doblo Essence 1.8",
    tipoFrota: "ADMINISTRATIVA",
    status: "DISPONIVEL",
    capacidadeMaxima: 6,
    ativo: true,
  },
];

const MOTORISTAS_DISPONIVEIS = [
  {
    id: "mot-01",
    cpf: "12345678909",
    numeroCnh: "12345678901",
    categoriaCnh: "D",
    validadeCnh: "2028-12-31T00:00:00.000Z",
    status: "DISPONIVEL",
    ativo: true,
    usuario: {
      id: "usr-mot-01",
      nome: "Roberto Nascimento",
      email: "roberto@fsph.se.gov.br",
    },
  },
];

function montarRespostaListagem(lista: SolicitacaoViagem[]) {
  const contar = (status: SolicitacaoViagem["status"]) =>
    lista.filter((item) => item.status === status).length;

  return {
    data: lista,
    meta: {
      page: 1,
      pageSize: 20,
      total: lista.length,
      totalPages: 1,
      porStatus: {
        PENDENTE: contar("PENDENTE"),
        APROVADA: contar("APROVADA"),
        EM_TRANSITO: contar("EM_TRANSITO"),
        CONCLUIDA: contar("CONCLUIDA"),
        RECUSADA: contar("RECUSADA"),
      },
    },
  };
}

function configurarSessao(roles: string[]) {
  localStorage.setItem(
    "@fsph_frota_user",
    JSON.stringify({
      id: "usr-teste",
      nome: roles.includes("GESTOR") ? "Vitor Santos" : "Marina Costa",
      email: "teste@fsph.se.gov.br",
      roles,
    }),
  );
  localStorage.setItem("@fsph_frota_token", "token-jwt-teste");
}

function renderPage(roles: string[] = ["SOLICITANTE"]) {
  configurarSessao(roles);
  return render(
    <AuthProvider>
      <SolicitacoesPage />
    </AuthProvider>,
  );
}

function dataFuturaLocal(dias: number, hora: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

describe("SolicitacoesPage (integrada à API)", () => {
  beforeEach(() => {
    localStorage.clear();
    const listaAtual = [...SOLICITACOES_INICIAIS];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/v1/solicitacoes") && method === "GET") {
        return new Response(JSON.stringify(montarRespostaListagem(listaAtual)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/solicitacoes") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        const criada: SolicitacaoViagem = {
          id: "sol-nova-01",
          protocolo: "SV-2026-0148",
          solicitanteNome: "Marina Costa",
          setorOrigem: String(body.setorOrigem ?? "LACEN"),
          origem: String(body.origem ?? ""),
          destino: String(body.destino ?? ""),
          dataHoraPretendida: String(body.dataHoraPretendida ?? new Date().toISOString()),
          quantidadePassageiros: Number(body.quantidadePassageiros ?? 1),
          tipoTransporte:
            (body.tipoTransporte as SolicitacaoViagem["tipoTransporte"]) ?? "PASSAGEIROS",
          urgencia: (body.urgencia as SolicitacaoViagem["urgencia"]) ?? "NORMAL",
          justificativa: String(body.justificativa ?? ""),
          status: "PENDENTE",
          criadoEm: new Date().toISOString(),
        };
        listaAtual.unshift(criada);
        return new Response(JSON.stringify(criada), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/veiculos") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: VEICULOS_DISPONIVEIS,
            meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/motoristas") && method === "GET") {
        return new Response(JSON.stringify(MOTORISTAS_DISPONIVEIS), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/aprovar") && method === "PATCH") {
        const alvo = listaAtual[0];
        const aprovada: SolicitacaoViagem = {
          ...alvo,
          status: "APROVADA",
          veiculoAlocado: { placa: "QMA-4821", modelo: "Fiat Doblo Essence 1.8" },
          motoristaAlocado: { nome: "Roberto Nascimento" },
        };
        return new Response(JSON.stringify(aprovada), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/recusar") && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { motivoRecusa?: string };
        const alvo = listaAtual[0];
        const recusada: SolicitacaoViagem = {
          ...alvo,
          status: "RECUSADA",
          motivoRecusa: body.motivoRecusa ?? "Recusado pelo gestor.",
        };
        return new Response(JSON.stringify(recusada), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Rota não mapeada no teste" }), { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("lista as solicitações vindas da API e mostra os indicadores na visão do solicitante", async () => {
    renderPage(["SOLICITANTE"]);

    expect(
      screen.getByRole("heading", { name: "Minhas Solicitações de Viagem" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("SV-2026-0142")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("filtra por status recusada", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0142");
    await user.click(screen.getByRole("tab", { name: "Recusadas" }));

    expect(screen.getByText("SV-2026-0098")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0142")).not.toBeInTheDocument();
  });

  it("exibe erros de validação ao enviar o formulário vazio", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0142");
    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));

    expect(await screen.findByText("Informe o local de partida.")).toBeInTheDocument();
    expect(screen.getByText("Informe o destino da viagem.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data e hora de saída.")).toBeInTheDocument();
  });

  it("cria uma nova solicitação pendente enviando POST para a API", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0142");
    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.type(screen.getByLabelText(/^origem/i), "LACEN — Aracaju");
    await user.type(screen.getByLabelText(/^destino/i), "Hospital de Propriá");
    fireEvent.change(screen.getByLabelText(/data e hora de saída/i), {
      target: { value: dataFuturaLocal(3, 9) },
    });
    await user.type(
      screen.getByLabelText(/^justificativa/i),
      "Transporte de equipe para capacitação.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/SV-2026-0148/i);
    expect(screen.getByText("Hospital de Propriá")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });

  it("mostra veículo e motorista nos detalhes de uma viagem aprovada", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0137");
    await user.click(
      screen.getByRole("button", { name: "Ver detalhes da solicitação SV-2026-0137" }),
    );

    const dialogo = screen
      .getByText("Solicitação SV-2026-0137")
      .closest("div.relative") as HTMLElement;
    expect(within(dialogo).getByText("BRA-2E19")).toBeInTheDocument();
    expect(within(dialogo).getByText("Carlos Alberto")).toBeInTheDocument();
  });

  it("exibe a fila de análise prioritária URGENTE e filtra por setor na visão do GESTOR", async () => {
    const user = userEvent.setup();
    renderPage(["GESTOR"]);

    expect(
      screen.getByRole("heading", { name: "Gestão de Solicitações de Viagem" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Fila de Análise Prioritária/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por setor"), "Hemose");
    expect(screen.getByText("SV-2026-0137")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0098")).not.toBeInTheDocument();
  });

  it("permite ao GESTOR aprovar uma solicitação pendente alocando veículo e motorista", async () => {
    const user = userEvent.setup();
    renderPage(["GESTOR"]);

    await screen.findByText(/Fila de Análise Prioritária/i);
    await user.click(screen.getByRole("button", { name: "Aprovar solicitação SV-2026-0142" }));

    const selectVeiculo = await screen.findByLabelText(/Veículo disponível/i);
    await user.selectOptions(selectVeiculo, "veic-01");

    const selectMotorista = screen.getByLabelText(/Motorista disponível/i);
    await user.selectOptions(selectMotorista, "mot-01");

    await user.click(screen.getByRole("button", { name: "Confirmar Aprovação e Alocação" }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/QMA-4821/i);
    expect(aviso).toHaveTextContent(/Roberto Nascimento/i);
  });

  it("permite ao GESTOR recusar uma solicitação pendente informando justificativa", async () => {
    const user = userEvent.setup();
    renderPage(["ADMIN"]);

    await screen.findByText(/Fila de Análise Prioritária/i);
    await user.click(screen.getByRole("button", { name: "Recusar solicitação SV-2026-0142" }));

    await user.type(
      screen.getByLabelText(/Motivo da recusa/i),
      "Sem viatura administrativa disponível neste turno.",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar Recusa" }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/recusada/i);
  });
});
