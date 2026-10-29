import { fireEvent, render, screen } from "@testing-library/react";
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

function montarRespostaListagem(listaCompleta: SolicitacaoViagem[], urlStr: string) {
  const url = new URL(urlStr, "http://localhost:3000");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const statusParam = url.searchParams.get("status");
  const urgenciaParam = url.searchParams.get("urgencia");
  const setorParam = url.searchParams.get("setorOrigem");
  const buscaParam = url.searchParams.get("busca")?.toLowerCase();

  const statusPermitidos = statusParam ? statusParam.split(",") : null;

  const baseFiltrada = listaCompleta.filter((item) => {
    if (urgenciaParam && item.urgencia !== urgenciaParam) return false;
    if (setorParam && item.setorOrigem !== setorParam) return false;
    if (buscaParam) {
      const bate =
        item.protocolo.toLowerCase().includes(buscaParam) ||
        item.origem.toLowerCase().includes(buscaParam) ||
        item.destino.toLowerCase().includes(buscaParam);
      if (!bate) return false;
    }
    return true;
  });

  const contar = (status: SolicitacaoViagem["status"]) =>
    baseFiltrada.filter((item) => item.status === status).length;

  const filtradaComStatus = statusPermitidos
    ? baseFiltrada.filter((item) => statusPermitidos.includes(item.status))
    : baseFiltrada;

  const inicio = (page - 1) * pageSize;
  const paginada = filtradaComStatus.slice(inicio, inicio + pageSize);

  return {
    data: paginada,
    meta: {
      page,
      pageSize,
      total: filtradaComStatus.length,
      totalPages: Math.max(1, Math.ceil(filtradaComStatus.length / pageSize)),
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
  let listaAtual: SolicitacaoViagem[];

  beforeEach(() => {
    localStorage.clear();
    listaAtual = [...SOLICITACOES_INICIAIS];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/v1/solicitacoes") && method === "GET") {
        return new Response(JSON.stringify(montarRespostaListagem(listaAtual, url)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/solicitacoes") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        const criada: SolicitacaoViagem = {
          id: `sol-nova-${listaAtual.length + 1}`,
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
        listaAtual[0] = aprovada;
        return new Response(
          JSON.stringify({ mensagem: "Solicitação aprovada com sucesso.", dados: aprovada }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/recusar") && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { motivoRecusa?: string };
        const alvo = listaAtual[0];
        const recusada: SolicitacaoViagem = {
          ...alvo,
          status: "RECUSADA",
          motivoRecusa: body.motivoRecusa ?? "Recusado pelo gestor.",
        };
        listaAtual[0] = recusada;
        return new Response(
          JSON.stringify({ mensagem: "Solicitação recusada com sucesso.", dados: recusada }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
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

  it("filtra por status recusada consultando a API", async () => {
    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0142");
    await user.click(screen.getByRole("tab", { name: "Recusadas" }));

    expect(await screen.findByText("SV-2026-0098")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0142")).not.toBeInTheDocument();
  });

  it("aplica busca no servidor encontrando solicitações fora da primeira página", async () => {
    listaAtual = Array.from({ length: 21 }, (_, idx) => ({
      ...SOLICITACOES_INICIAIS[1],
      id: `sol-pag-${idx + 1}`,
      protocolo: `SV-2026-${String(200 + idx).padStart(4, "0")}`,
      destino: idx === 20 ? "Hospital Regional de Estância" : "Destino Comum",
      status: "APROVADA" as const,
      urgencia: "NORMAL" as const,
    }));

    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0200");
    expect(screen.queryByText("Hospital Regional de Estância")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar solicitações"), "Estância");

    expect(await screen.findByText("Hospital Regional de Estância")).toBeInTheDocument();
  });

  it("atualiza a paginação após criar a 21ª solicitação", async () => {
    listaAtual = Array.from({ length: 20 }, (_, idx) => ({
      ...SOLICITACOES_INICIAIS[1],
      id: `sol-lote-${idx + 1}`,
      protocolo: `SV-2026-${String(300 + idx).padStart(4, "0")}`,
      status: "APROVADA" as const,
      urgencia: "NORMAL" as const,
    }));

    const user = userEvent.setup();
    renderPage(["SOLICITANTE"]);

    await screen.findByText("SV-2026-0300");
    expect(screen.queryByRole("button", { name: "Próxima" })).not.toBeInTheDocument();

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

    expect(await screen.findByRole("status")).toHaveTextContent(/SV-2026-0148/i);
    expect(await screen.findByRole("button", { name: "Próxima" })).toBeInTheDocument();
  });

  it("exibe detalhes dos campos inválidos vindos em errors do backend", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/v1/solicitacoes") && method === "POST") {
        return new Response(
          JSON.stringify({
            statusCode: 400,
            message: "Dados inválidos.",
            errors: [{ campo: "dataHoraPretendida", mensagem: "A data de saída deve ser futura." }],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify(montarRespostaListagem(listaAtual, url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

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

    expect(await screen.findByRole("alert")).toHaveTextContent("A data de saída deve ser futura.");
  });

  it("exibe a fila prioritária URGENTE mesmo quando o pedido urgente está em outra página", async () => {
    listaAtual = [
      ...Array.from({ length: 20 }, (_, idx) => ({
        ...SOLICITACOES_INICIAIS[1],
        id: `sol-pag1-${idx + 1}`,
        protocolo: `SV-2026-${String(400 + idx).padStart(4, "0")}`,
        status: "APROVADA" as const,
        urgencia: "NORMAL" as const,
      })),
      {
        ...SOLICITACOES_INICIAIS[0],
        id: "sol-urg-pag2",
        protocolo: "SV-2026-0999",
        status: "PENDENTE",
        urgencia: "URGENTE",
      },
    ];

    renderPage(["GESTOR"]);

    expect(await screen.findByText(/Fila de Análise Prioritária/i)).toBeInTheDocument();
    expect(screen.getByText("SV-2026-0999")).toBeInTheDocument();
  });

  it("permite ao GESTOR filtrar por setor na API e aprovar alocando veículo e motorista", async () => {
    const user = userEvent.setup();
    renderPage(["GESTOR"]);

    await screen.findByText(/Fila de Análise Prioritária/i);

    await user.selectOptions(screen.getByLabelText("Filtrar por setor"), "Hemose");
    expect(await screen.findByText("SV-2026-0137")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0098")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por setor"), "TODOS");
    await screen.findAllByText("SV-2026-0142");

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
