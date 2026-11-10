import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarMeusAbastecimentosApi,
  registrarAbastecimentoMotoristaApi,
} from "../../../src/services/abastecimentosService";
import { listarMinhasViagensApi } from "../../../src/services/solicitacoesService";
import type { ListaAbastecimentosResposta } from "../../../src/types/abastecimento";
import type { ListaMinhasViagensResposta } from "../../../src/types/solicitacao";
import { MinhasViagensPage } from "../../../src/pages/viagens/MinhasViagensPage";

vi.mock("../../../src/contexts/auth", () => ({
  useAuth: () => ({ sessionKey: "test-session" }),
}));

vi.mock("../../../src/services/solicitacoesService", () => ({
  listarMinhasViagensApi: vi.fn(),
}));

vi.mock("../../../src/services/abastecimentosService", () => ({
  listarMeusAbastecimentosApi: vi.fn(),
  registrarAbastecimentoMotoristaApi: vi.fn(),
}));

vi.mock("../../../src/pages/viagens/ChecklistViagemModal", () => ({
  ChecklistViagemModal: ({ modo }: { modo: string }) => <div role="dialog">Checklist {modo}</div>,
}));

const viagem: ListaMinhasViagensResposta["data"][number] = {
  id: "viagem-1",
  protocolo: "SV-2026-0042",
  solicitanteNome: "Equipe Hemose",
  setorOrigem: "Hemose",
  origem: "Hemose — Aracaju",
  destino: "LACEN — Unidade Central",
  dataHoraPretendida: "2026-11-03T08:30:00-03:00",
  quantidadePassageiros: 2,
  tipoTransporte: "PASSAGEIROS",
  urgencia: "NORMAL",
  justificativa: "Transporte institucional.",
  status: "APROVADA",
  criadoEm: "2026-11-01T10:00:00-03:00",
  veiculoAlocado: { placa: "QKN-2A34", modelo: "Fiat Argo", odometroAtual: 42510 },
  motoristaAlocado: { nome: "Motorista" },
  execucao: null,
};

const lista: ListaMinhasViagensResposta = {
  data: [viagem],
  viagemEmAndamento: null,
  meta: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    porStatus: { PENDENTE: 0, APROVADA: 1, EM_TRANSITO: 0, CONCLUIDA: 0, RECUSADA: 0 },
  },
};

const listaAbastecimentosVazia: ListaAbastecimentosResposta = {
  data: [],
  meta: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
};

describe("MinhasViagensPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarMinhasViagensApi).mockResolvedValue(lista);
    vi.mocked(listarMeusAbastecimentosApi).mockResolvedValue(listaAbastecimentosVazia);
  });

  it("carrega do endpoint do motorista e mantém as viagens a iniciar em destaque", async () => {
    render(<MinhasViagensPage />);

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("LACEN — Unidade Central")).toBeInTheDocument();
    expect(screen.getByText("Solicitante: Equipe Hemose")).toBeInTheDocument();
    expect(listarMinhasViagensApi).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: ["APROVADA"],
    });

    await userEvent.click(screen.getByRole("button", { name: "Iniciar viagem" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Checklist SAIDA");
  });

  it.each(["meta ausente", "totalPages ausente"])(
    "renderiza normalmente quando %s",
    async (campoAusente) => {
      const resposta = { ...lista, meta: { ...lista.meta } };
      if (campoAusente === "meta ausente") {
        Reflect.deleteProperty(resposta, "meta");
      } else {
        Reflect.deleteProperty(resposta.meta, "totalPages");
      }
      vi.mocked(listarMinhasViagensApi).mockResolvedValue(resposta);

      render(<MinhasViagensPage />);

      expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
      expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
    },
  );

  it("apresenta erro para uma resposta sem a lista de viagens", async () => {
    const resposta = { ...lista };
    Reflect.deleteProperty(resposta, "data");
    vi.mocked(listarMinhasViagensApi).mockResolvedValue(resposta);

    render(<MinhasViagensPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar suas viagens. Atualize a página e tente novamente.",
    );
  });

  it("mantém a paginação e permite voltar quando a página atual fica vazia", async () => {
    const paginaVazia: ListaMinhasViagensResposta = {
      ...lista,
      data: [],
      meta: { ...lista.meta, page: 2, total: 21, totalPages: 2 },
    };
    vi.mocked(listarMinhasViagensApi)
      .mockResolvedValueOnce({ ...lista, meta: { ...lista.meta, total: 21, totalPages: 2 } })
      .mockResolvedValueOnce(paginaVazia);
    const user = userEvent.setup();

    render(<MinhasViagensPage />);

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima" }));

    expect(
      await screen.findByRole("heading", { name: "Nenhuma viagem nesta página" }),
    ).toBeVisible();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    expect(listarMinhasViagensApi).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      status: ["APROVADA"],
    });
  });

  it("volta à última página disponível quando os dados diminuem", async () => {
    const paginaVaziaForaDoIntervalo: ListaMinhasViagensResposta = {
      ...lista,
      data: [],
      meta: { ...lista.meta, page: 2, total: 1, totalPages: 1 },
    };
    vi.mocked(listarMinhasViagensApi)
      .mockResolvedValueOnce({ ...lista, meta: { ...lista.meta, total: 21, totalPages: 2 } })
      .mockResolvedValueOnce(paginaVaziaForaDoIntervalo)
      .mockResolvedValueOnce(lista);
    const user = userEvent.setup();

    render(<MinhasViagensPage />);

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima" }));

    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
    expect(listarMinhasViagensApi).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      status: ["APROVADA"],
    });
  });

  it("mantém a viagem em andamento visível junto da lista e bloqueia iniciar outra", async () => {
    vi.mocked(listarMinhasViagensApi).mockResolvedValue({
      ...lista,
      viagemEmAndamento: {
        ...viagem,
        id: "viagem-em-andamento",
        protocolo: "SV-2026-0041",
        status: "EM_TRANSITO",
        execucao: { kmInicial: 42510, dataHoraInicio: "2026-11-03T08:35:00-03:00" },
      },
    });

    render(<MinhasViagensPage />);

    expect(await screen.findByRole("heading", { name: "Minhas viagens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Viagem em andamento" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Filtrar viagens" })).toBeInTheDocument();
    expect(screen.getByText("SV-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("SV-2026-0041")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar viagem" })).toBeDisabled();

    expect(screen.getAllByText("LACEN — Unidade Central")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Retomar checklist" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Checklist RETORNO");
  });

  it("apresenta erro de carregamento e permite tentar novamente", async () => {
    const user = userEvent.setup();
    vi.mocked(listarMinhasViagensApi)
      .mockRejectedValueOnce(new Error("Falha de conexão"))
      .mockResolvedValueOnce(lista);

    render(<MinhasViagensPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("SV-2026-0042")).toBeInTheDocument();
    await waitFor(() => expect(listarMinhasViagensApi).toHaveBeenCalledTimes(2));
  });

  it("exibe o posto credenciado no histórico de abastecimentos do motorista", async () => {
    vi.mocked(listarMeusAbastecimentosApi).mockResolvedValue({
      data: [
        {
          id: "abast-1",
          veiculoId: "veic-1",
          dataHora: "2026-11-03T10:15:00-03:00",
          odometro: 42650,
          litros: 35.5,
          valorTotal: 216.55,
          postoCredenciado: "Posto Prime BR-101 — Aracaju",
          kmPorLitro: 11.4,
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });

    render(<MinhasViagensPage />);

    expect(await screen.findByText("Posto Prime BR-101 — Aracaju")).toBeInTheDocument();
    expect(screen.getByText("42.650 km")).toBeInTheDocument();
    expect(screen.getByText("35,5 L")).toBeInTheDocument();
    expect(screen.getByText("11,4 km/L")).toBeInTheDocument();
    expect(listarMeusAbastecimentosApi).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
    });
  });

  it("abre o modal Registrar Abastecimento (Cartão Prime), valida e envia o registro com posto credenciado", async () => {
    const user = userEvent.setup();
    const novoAbastecimento = {
      id: "abast-novo",
      veiculoId: "veic-1",
      dataHora: "2026-11-03T11:20:00-03:00",
      odometro: 42780,
      litros: 40,
      valorTotal: 244,
      postoCredenciado: "Posto Petrox Jardins (Rede Prime)",
      kmPorLitro: 12.1,
    };

    vi.mocked(listarMinhasViagensApi).mockResolvedValue({
      ...lista,
      viagemEmAndamento: {
        ...viagem,
        id: "viagem-em-andamento",
        protocolo: "SV-2026-0041",
        status: "EM_TRANSITO",
        execucao: { kmInicial: 42510, dataHoraInicio: "2026-11-03T08:35:00-03:00" },
      },
    });
    vi.mocked(listarMeusAbastecimentosApi)
      .mockResolvedValueOnce(listaAbastecimentosVazia)
      .mockResolvedValueOnce({
        data: [novoAbastecimento],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });
    vi.mocked(registrarAbastecimentoMotoristaApi).mockResolvedValue(novoAbastecimento);

    render(<MinhasViagensPage />);

    expect(await screen.findByText("SV-2026-0041")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Registrar abastecimento (Cartão Prime)" }),
    );

    expect(
      screen.getByRole("heading", { name: "Registrar Abastecimento (Cartão Prime)" }),
    ).toBeInTheDocument();

    // Tenta submeter vazio para validar mensagens de erro
    await user.click(screen.getByRole("button", { name: "Confirmar abastecimento" }));
    expect(screen.getByText("Informe a quilometragem exibida no odômetro.")).toBeInTheDocument();
    expect(screen.getByText("Informe a quantidade abastecida em litros.")).toBeInTheDocument();
    expect(screen.getByText("Informe o valor total do abastecimento.")).toBeInTheDocument();

    // Preenche os dados do comprovante da Rede Prime
    await user.type(screen.getByLabelText(/Odômetro no abastecimento/i), "42780");
    await user.type(screen.getByLabelText(/Litros abastecidos/i), "40");
    await user.type(screen.getByLabelText(/Valor total/i), "244,00");
    await user.type(
      screen.getByLabelText(/Posto credenciado \(Rede Prime\)/i),
      "Posto Petrox Jardins (Rede Prime)",
    );

    await user.click(screen.getByRole("button", { name: "Confirmar abastecimento" }));

    await waitFor(() =>
      expect(registrarAbastecimentoMotoristaApi).toHaveBeenCalledWith({
        odometro: 42780,
        litros: 40,
        valorTotal: 244,
        postoCredenciado: "Posto Petrox Jardins (Rede Prime)",
      }),
    );

    expect(
      await screen.findByText("Abastecimento registrado com sucesso via Cartão Prime."),
    ).toBeInTheDocument();
    expect(screen.getByText("Posto Petrox Jardins (Rede Prime)")).toBeInTheDocument();
  });
});
