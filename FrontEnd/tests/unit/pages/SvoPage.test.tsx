import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../helpers/auth";
import { setTestRoles } from "../../helpers/authState";
import { SvoPage } from "../../../src/pages/svo/SvoPage";
import type {
  ChamadoSvo,
  EscalaSvo,
  IndicadoresSvo,
  MotoristaSvo,
  PaginaChamadosSvo,
  ViaturaSvo,
} from "../../../src/services/svo";

const svosMocks = vi.hoisted(() => ({
  obterIndicadoresSvo: vi.fn(),
  obterChamadosSvo: vi.fn(),
  criarChamadoSvo: vi.fn(),
  triarChamadoSvo: vi.fn(),
  criarOrdemColetaSvo: vi.fn(),
  avancarEtapaColetaSvo: vi.fn(),
  cancelarOrdemColetaSvo: vi.fn(),
  concluirDesinfeccaoSvo: vi.fn(),
  obterViaturasSvo: vi.fn(),
  obterMotoristasSvo: vi.fn(),
  obterEscalasEmAndamentoSvo: vi.fn(),
}));

vi.mock("../../../src/services/svo", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../src/services/svo")>();
  return {
    ...real,
    obterIndicadoresSvo: svosMocks.obterIndicadoresSvo,
    obterChamadosSvo: svosMocks.obterChamadosSvo,
    criarChamadoSvo: svosMocks.criarChamadoSvo,
    triarChamadoSvo: svosMocks.triarChamadoSvo,
    criarOrdemColetaSvo: svosMocks.criarOrdemColetaSvo,
    avancarEtapaColetaSvo: svosMocks.avancarEtapaColetaSvo,
    cancelarOrdemColetaSvo: svosMocks.cancelarOrdemColetaSvo,
    concluirDesinfeccaoSvo: svosMocks.concluirDesinfeccaoSvo,
    obterViaturasSvo: svosMocks.obterViaturasSvo,
    obterMotoristasSvo: svosMocks.obterMotoristasSvo,
    obterEscalasEmAndamentoSvo: svosMocks.obterEscalasEmAndamentoSvo,
  };
});

const CHAMADOS_BASE: ChamadoSvo[] = [
  {
    id: "cham-01",
    numeroProtocolo: "SVO-2026-0001",
    atendenteId: "user-svo",
    nomeFalecido: "Antônio Pereira",
    enderecoOcorrencia: "Rua das Acácias, 184 · Atalaia, Aracaju",
    relatoOcorrencia: "Óbito domiciliar relatado pela família sem sinais externos.",
    statusTriagem: "EM_ANALISE",
    justificativaTriagem: null,
    ordemColeta: null,
  },
  {
    id: "cham-02",
    numeroProtocolo: "SVO-2026-0002",
    atendenteId: "user-svo",
    nomeFalecido: "Maria Oliveira",
    enderecoOcorrencia: "Conj. Jardim · Nossa Senhora do Socorro",
    relatoOcorrencia: "Solicitação avaliada pelo plantonista.",
    statusTriagem: "APROVADO",
    justificativaTriagem: "Critérios clínicos compatíveis.",
    ordemColeta: null,
  },
];

const VIATURAS_BASE: ViaturaSvo[] = [
  {
    id: "viat-01",
    placa: "QMA4J28",
    modelo: "Chevrolet S10 SVO 01",
    status: "DISPONIVEL",
    capacidadeMaxima: 4,
    ativo: true,
    ocupacaoAtual: 0,
    motoristaAtual: null,
  },
  {
    id: "viat-02",
    placa: "QMD2C71",
    modelo: "Chevrolet S10 SVO 02",
    status: "DESINFECCAO",
    capacidadeMaxima: 4,
    ativo: true,
    ocupacaoAtual: 0,
    motoristaAtual: null,
  },
];

const MOTORISTAS_BASE: MotoristaSvo[] = [
  {
    id: "mot-01",
    status: "DISPONIVEL",
    numeroCnh: "12345678901",
    categoriaCnh: "B",
    usuario: { nome: "Roberto Lima" },
  },
];

const ESCALAS_BASE: EscalaSvo[] = [
  {
    id: "escala-01",
    motorista: { id: "mot-01", nome: "Roberto Lima", telefone: null, ativo: true },
    veiculo: {
      id: "viat-01",
      placa: "QMA4J28",
      modelo: "Chevrolet S10 SVO 01",
      status: "DISPONIVEL",
      ativo: true,
    },
    inicioTurno: "2026-11-03T07:00:00-03:00",
    fimTurno: "2026-11-03T19:00:00-03:00",
    observacoes: null,
    encerradaEm: null,
    situacao: "EM_ANDAMENTO",
  },
];

function renderSvoPage() {
  setTestRoles(["SVO"]);
  return render(
    <AuthProvider>
      <SvoPage />
    </AuthProvider>,
  );
}

describe("SvoPage (integrada à API real)", () => {
  let dbChamados: ChamadoSvo[];
  let dbViaturas: ViaturaSvo[];

  it("atualiza fila e médias automaticamente após uma coleta registrada no celular", async () => {
    vi.useFakeTimers({ toFake: ["setInterval"] });
    try {
      renderSvoPage();
      await screen.findByText("Antônio Pereira");
      dbChamados = dbChamados.filter((chamado) => chamado.id !== "cham-01");
      svosMocks.obterIndicadoresSvo.mockResolvedValueOnce({
        total: 1,
        emAnalise: 0,
        aguardandoOrdem: 1,
        aprovados: 1,
        recusados: 0,
        coletasEmAndamento: 0,
        viaturasDisponiveis: 1,
        totalViaturas: 2,
        tempoMedioChegadaLocalMinutos: 30,
        tempoMedioEntregaSvoMinutos: 90,
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(screen.queryByText("Antônio Pereira")).not.toBeInTheDocument();
      expect(screen.getByText("30 min")).toBeInTheDocument();
      expect(screen.getByText("1 h 30 min")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  beforeEach(() => {
    dbChamados = structuredClone(CHAMADOS_BASE);
    dbViaturas = structuredClone(VIATURAS_BASE);

    svosMocks.obterIndicadoresSvo.mockImplementation(async (): Promise<IndicadoresSvo> => ({
      total: dbChamados.length,
      emAnalise: dbChamados.filter((c) => c.statusTriagem === "EM_ANALISE").length,
      aguardandoOrdem: dbChamados.filter((c) => c.statusTriagem === "APROVADO" && !c.ordemColeta)
        .length,
      aprovados: dbChamados.filter((c) => c.statusTriagem === "APROVADO").length,
      recusados: dbChamados.filter((c) => c.statusTriagem === "RECUSADO").length,
      coletasEmAndamento: dbChamados.filter((c) =>
        ["EM_ANDAMENTO", "EM_DESLOCAMENTO", "NO_LOCAL"].includes(c.ordemColeta?.status ?? ""),
      ).length,
      viaturasDisponiveis: dbViaturas.filter((v) => v.status === "DISPONIVEL").length,
      totalViaturas: dbViaturas.length,
      tempoMedioChegadaLocalMinutos: 18,
      tempoMedioEntregaSvoMinutos: 45,
    }));

    svosMocks.obterChamadosSvo.mockImplementation(
      async (params?: {
        etapa?: string;
        busca?: string;
        page?: number;
        pageSize?: number;
      }): Promise<PaginaChamadosSvo> => {
        const page = params?.page ?? 1;
        const pageSize = params?.pageSize ?? 10;
        let lista = [...dbChamados];

        if (params?.etapa === "EM_ANALISE") {
          lista = lista.filter((c) => c.statusTriagem === "EM_ANALISE");
        } else if (params?.etapa === "AGUARDANDO_ORDEM") {
          lista = lista.filter((c) => c.statusTriagem === "APROVADO" && !c.ordemColeta);
        } else if (params?.etapa === "EM_OPERACAO") {
          lista = lista.filter(
            (c) =>
              c.statusTriagem === "APROVADO" &&
              ["AGUARDANDO_DESPACHO", "EM_ANDAMENTO", "EM_DESLOCAMENTO", "NO_LOCAL"].includes(
                c.ordemColeta?.status ?? "",
              ),
          );
        } else if (params?.etapa === "ENCERRADO") {
          lista = lista.filter(
            (c) =>
              c.statusTriagem === "RECUSADO" ||
              ["CONCLUIDA", "ENTREGUE_SVO", "CANCELADA"].includes(c.ordemColeta?.status ?? ""),
          );
        }

        if (params?.busca) {
          const termo = params.busca.toLowerCase();
          lista = lista.filter(
            (c) =>
              (c.numeroProtocolo ?? "").toLowerCase().includes(termo) ||
              (c.nomeFalecido ?? "").toLowerCase().includes(termo) ||
              (c.enderecoOcorrencia ?? "").toLowerCase().includes(termo),
          );
        }

        const total = lista.length;
        const inicio = (page - 1) * pageSize;
        return {
          data: lista.slice(inicio, inicio + pageSize),
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        };
      },
    );

    svosMocks.obterViaturasSvo.mockImplementation(async () => structuredClone(dbViaturas));
    svosMocks.obterMotoristasSvo.mockImplementation(async () => structuredClone(MOTORISTAS_BASE));
    svosMocks.obterEscalasEmAndamentoSvo.mockResolvedValue([]);

    svosMocks.criarChamadoSvo.mockImplementation(async (input) => {
      const novo: ChamadoSvo = {
        id: `cham-novo-${dbChamados.length + 1}`,
        numeroProtocolo: `SVO-2026-${String(dbChamados.length + 1).padStart(4, "0")}`,
        atendenteId: "user-svo",
        nomeFalecido: input.nomeFalecido,
        enderecoOcorrencia: input.enderecoOcorrencia,
        relatoOcorrencia: input.relatoOcorrencia,
        statusTriagem: "EM_ANALISE",
        ordemColeta: null,
      };
      dbChamados = [novo, ...dbChamados];
      return novo;
    });

    svosMocks.triarChamadoSvo.mockImplementation(async (id, input) => {
      const novoStatus = input.decisao === "APROVAR" ? "APROVADO" : "RECUSADO";
      dbChamados = dbChamados.map((c) =>
        c.id === id
          ? {
              ...c,
              statusTriagem: novoStatus,
              justificativaTriagem: input.justificativa ?? null,
            }
          : c,
      );
      return dbChamados.find((c) => c.id === id)!;
    });

    svosMocks.criarOrdemColetaSvo.mockImplementation(async (id, input) => {
      const viat = dbViaturas.find((v) => v.id === input.veiculoId)!;
      const mot = MOTORISTAS_BASE.find((m) => m.id === input.motoristaId)!;
      const ordem = {
        id: "ord-nova",
        chamadoId: id,
        veiculoId: viat.id,
        motoristaId: mot.id,
        status: "AGUARDANDO_DESPACHO",
        numeroDeclaracaoObito: input.numeroDeclaracaoObito ?? null,
        dataHoraSaida: null,
        veiculo: {
          id: viat.id,
          placa: viat.placa,
          modelo: viat.modelo,
          status: "DISPONIVEL",
          capacidadeMaxima: viat.capacidadeMaxima,
        },
        motorista: mot,
      };
      dbChamados = dbChamados.map((c) => (c.id === id ? { ...c, ordemColeta: ordem } : c));
      dbViaturas = dbViaturas.map((v) =>
        v.id === viat.id
          ? {
              ...v,
              status: "DISPONIVEL",
              ocupacaoAtual: v.ocupacaoAtual + 1,
              motoristaAtual: { id: mot.id, nome: mot.usuario?.nome ?? null },
            }
          : v,
      );
      return ordem;
    });

    svosMocks.concluirDesinfeccaoSvo.mockImplementation(async (veiculoId) => {
      dbViaturas = dbViaturas.map((v) =>
        v.id === veiculoId ? { ...v, status: "DISPONIVEL", ocupacaoAtual: 0 } : v,
      );
      return dbViaturas.find((v) => v.id === veiculoId)!;
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("mantém o filtro atual utilizável sem travar o carregamento", async () => {
    const user = userEvent.setup();
    renderSvoPage();
    await screen.findByText("SVO-2026-0001");
    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByRole("button", { name: "Atualizar dados SVO" })).toBeEnabled();
  });

  it("preserva falha de recursos mesmo quando a listagem termina depois", async () => {
    let resolver!: (pagina: PaginaChamadosSvo) => void;
    svosMocks.obterChamadosSvo.mockImplementationOnce(
      () =>
        new Promise<PaginaChamadosSvo>((resolve) => {
          resolver = resolve;
        }),
    );
    svosMocks.obterViaturasSvo.mockRejectedValueOnce(new Error("Viaturas indisponíveis"));
    renderSvoPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Viaturas indisponíveis");
    resolver({ data: CHAMADOS_BASE, meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 } });
    await screen.findByText("SVO-2026-0001");
    expect(screen.getByRole("alert")).toHaveTextContent("Viaturas indisponíveis");
  });

  it("não pré-seleciona motorista ocupado de outra viatura", async () => {
    svosMocks.obterMotoristasSvo.mockResolvedValueOnce([
      { ...MOTORISTAS_BASE[0]!, status: "OCUPADO" },
    ]);
    const user = userEvent.setup();
    renderSvoPage();
    await screen.findByText("SVO-2026-0002");
    await user.click(screen.getByRole("button", { name: "Emitir ordem" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Emitir ordem de coleta" })).toBeDisabled(),
    );
    expect(svosMocks.criarOrdemColetaSvo).not.toHaveBeenCalled();
  });

  it("não oferece nem pré-seleciona motorista sem status de disponibilidade", async () => {
    const motoristaSemStatus = { ...MOTORISTAS_BASE[0]! };
    delete motoristaSemStatus.status;
    svosMocks.obterMotoristasSvo.mockResolvedValueOnce([motoristaSemStatus]);
    const user = userEvent.setup();
    renderSvoPage();

    await screen.findByText("SVO-2026-0002");
    await user.click(screen.getByRole("button", { name: "Emitir ordem" }));

    expect(await screen.findByLabelText(/Motorista habilitado/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Emitir ordem de coleta" })).toBeDisabled();
    expect(svosMocks.criarOrdemColetaSvo).not.toHaveBeenCalled();
  });

  it("permite o motorista ocupado quando ele já está alocado à viatura em viagem", async () => {
    const viaturaEmViagem: ViaturaSvo = {
      ...VIATURAS_BASE[0]!,
      status: "EM_VIAGEM",
      ocupacaoAtual: 1,
      motoristaAtual: { id: MOTORISTAS_BASE[0]!.id, nome: "Roberto Lima" },
    };
    svosMocks.obterViaturasSvo.mockResolvedValueOnce([viaturaEmViagem]);
    svosMocks.obterMotoristasSvo.mockResolvedValueOnce([
      { ...MOTORISTAS_BASE[0]!, status: "OCUPADO" },
    ]);
    const user = userEvent.setup();
    renderSvoPage();

    await screen.findByText("SVO-2026-0002");
    await user.click(screen.getByRole("button", { name: "Emitir ordem" }));

    expect(await screen.findByLabelText(/Viatura SVO/)).toHaveValue(viaturaEmViagem.id);
    expect(await screen.findByLabelText(/Motorista habilitado/)).toHaveValue(
      MOTORISTAS_BASE[0]!.id,
    );
    expect(screen.getByRole("button", { name: "Emitir ordem de coleta" })).toBeEnabled();
  });

  it("mostra o tempo decorrido de SLA nos chamados ainda abertos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T12:18:00.000Z"));
    dbChamados = [
      {
        ...CHAMADOS_BASE[0]!,
        criadoEm: "2026-11-10T12:00:00.000Z",
      },
    ];
    try {
      renderSvoPage();
      expect(await screen.findByText("SLA 18 min")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("carrega chamados, indicadores e viaturas reais da API e filtra por busca no servidor", async () => {
    const user = userEvent.setup();
    renderSvoPage();

    expect(await screen.findByText("SVO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("SVO-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Chevrolet S10 SVO 01")).toBeInTheDocument();
    expect(screen.getByText("Tempo médio até o local")).toBeInTheDocument();
    expect(screen.getByText("18 min")).toBeInTheDocument();
    expect(screen.getByText("Tempo médio até a entrega")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar chamado"), "Socorro");

    expect(await screen.findByText("SVO-2026-0002")).toBeInTheDocument();
    expect(screen.queryByText("SVO-2026-0001")).not.toBeInTheDocument();
  });

  it("destaca as escalas ativas e pré-seleciona a dupla do plantão ao emitir uma ordem", async () => {
    svosMocks.obterEscalasEmAndamentoSvo.mockResolvedValue(ESCALAS_BASE);
    const user = userEvent.setup();
    renderSvoPage();

    expect(await screen.findByText("Plantão atual")).toBeInTheDocument();
    expect(await screen.findByText("Pronto para despacho")).toBeInTheDocument();
    expect(screen.getByText("Roberto Lima")).toBeInTheDocument();
    expect(screen.getByText("Turno 07:00 – 19:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Emitir ordem" }));

    expect(await screen.findByLabelText(/Viatura SVO/)).toHaveValue("viat-01");
    expect(await screen.findByLabelText(/Motorista habilitado/)).toHaveValue("mot-01");
  });

  it("apresenta falha ao consultar escala sem bloquear a fila SVO", async () => {
    svosMocks.obterEscalasEmAndamentoSvo.mockRejectedValueOnce(
      new Error("Escalas temporariamente indisponíveis"),
    );
    renderSvoPage();

    expect(await screen.findByText("Plantão atual")).toBeInTheDocument();
    expect(await screen.findByText("Escalas temporariamente indisponíveis")).toBeInTheDocument();
    expect(await screen.findByText("SVO-2026-0001")).toBeInTheDocument();
  });

  it("registra um novo chamado na API e atualiza a paginação quando passa de 10 itens", async () => {
    dbChamados = Array.from({ length: 10 }, (_, idx) => ({
      ...CHAMADOS_BASE[0]!,
      id: `cham-${idx + 1}`,
      numeroProtocolo: `SVO-2026-${String(idx + 1).padStart(4, "0")}`,
    }));

    const user = userEvent.setup();
    renderSvoPage();

    await screen.findByText("SVO-2026-0001");
    expect(screen.getByRole("button", { name: /Próxima/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Registrar chamado/i }));
    await user.click(screen.getByLabelText(/Nome do falecido/i));
    await user.paste("João Batista");
    await user.click(screen.getByLabelText(/Endereço da ocorrência/i));
    await user.paste("Av. Beira Mar, 500");
    await user.click(screen.getByLabelText(/Relato da ocorrência/i));
    await user.paste("Óbito natural confirmado por médico assistente.");

    await user.click(screen.getByRole("button", { name: /^Salvar chamado$/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/SVO-2026-0011/i);
    expect(screen.getByRole("button", { name: /Próxima/i })).not.toBeDisabled();
  });

  it("aprova triagem, emite ordem de coleta com viatura e motorista reais e confirma desinfecção", async () => {
    const user = userEvent.setup();
    renderSvoPage();

    await screen.findByText("SVO-2026-0001");

    // Confirma desinfecção da viatura 02
    await user.click(screen.getByRole("button", { name: /Confirmar desinfecção/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/QMD2C71/i);

    // Inicia e aprova triagem do chamado 01
    await user.click(screen.getByRole("button", { name: /Iniciar triagem/i }));
    await user.click(screen.getByLabelText(/Justificativa \/ parecer da triagem/i));
    await user.paste("Critérios compatíveis com atendimento SVO.");
    await user.click(screen.getByRole("button", { name: /Aprovar triagem/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Triagem aprovada/i);

    // Emite ordem de coleta para o chamado aprovado
    const botoesEmitir = await screen.findAllByRole("button", { name: /Emitir ordem/i });
    await user.click(botoesEmitir[0]!);

    await user.type(screen.getByLabelText(/Declaração de Óbito/i), "DO-2026-7788");
    await user.click(screen.getByRole("button", { name: /Emitir ordem de coleta/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Ordem de coleta emitida/i);
  });
});
