import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../src/lib/api";
import {
  ChecklistViagemModal,
  type ViagemChecklistAlvo,
} from "../../../src/pages/viagens/ChecklistViagemModal";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));

const viagemBase: ViagemChecklistAlvo = {
  id: "00000000-0000-4000-8000-000000000010",
  protocolo: "SV-2026-0042",
  origem: "Sede FSPH — Aracaju/SE",
  destino: "LACEN — Aracaju/SE",
  veiculoAlocado: {
    placa: "QMA4J28",
    modelo: "Chevrolet Spin",
    odometroAtual: 38300,
  },
  execucao: null,
};

function criarArquivoImagem(nome = "odometro.jpg") {
  return new File(["conteudo-imagem-ficticia"], nome, { type: "image/jpeg" });
}

const onClose = vi.fn();
const onConcluido = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiRequest).mockResolvedValue({
    solicitacaoId: viagemBase.id,
    status: "EM_TRANSITO",
  });
});

describe("ChecklistViagemModal", () => {
  it("inicia itens como OK sem cliques extras e exige descrição se um item for marcado com problema", async () => {
    const user = userEvent.setup();
    render(
      <ChecklistViagemModal
        modo="SAIDA"
        viagem={viagemBase}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    const campoOdometro = screen.getByLabelText(/Odômetro inicial \(km\)/i);
    expect(campoOdometro).toHaveValue("38300");

    // Sem foto do odômetro bloqueia o envio
    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e iniciar" }));
    expect(screen.getByText(/Anexe uma foto legível do painel do odômetro/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();

    // Anexa foto do odômetro
    await user.upload(
      screen.getByLabelText(/Foto do painel do odômetro/i),
      criarArquivoImagem("painel-saida.jpg"),
    );
    expect(await screen.findByText(/Foto anexada/i)).toBeInTheDocument();

    // Tocar em um item marca como "Com problema" e exige descrição
    await user.click(screen.getByRole("button", { name: /Higiene e conservação interna/i }));
    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e iniciar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Descreva o problema identificado");
    expect(apiRequest).not.toHaveBeenCalled();

    // Restaurar todos para OK permite enviar sem cliques adicionais nos itens
    await user.click(screen.getByRole("button", { name: "Restaurar todos OK" }));
    await user.clear(campoOdometro);
    await user.type(campoOdometro, "38305,5");
    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e iniciar" }));

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(apiRequest).mock.calls[0]!;
    expect(url).toBe(`/solicitacoes/${viagemBase.id}/iniciar`);
    expect(options?.method).toBe("POST");
    const enviado = JSON.parse(String(options?.body));
    expect(enviado).toMatchObject({
      kmInicial: 38305.5,
      checklistSaida: {
        pneus: true,
        freiosLuzes: true,
        combustivel: true,
        documentos: true,
        limpeza: true,
        fotoOdometro: expect.stringMatching(/^data:image\/jpeg;base64,/),
      },
    });
    expect(onConcluido).toHaveBeenCalledWith(
      "Viagem SV-2026-0042 iniciada com sucesso.",
      expect.objectContaining({ status: "EM_TRANSITO" }),
    );
  });

  it("abre relato e foto opcional automaticamente ao marcar item com problema no retorno", async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockResolvedValueOnce({
      solicitacaoId: viagemBase.id,
      status: "CONCLUIDA",
    });

    render(
      <ChecklistViagemModal
        modo="RETORNO"
        viagem={{
          ...viagemBase,
          execucao: { kmInicial: 38300 },
        }}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    const campoOdometro = screen.getByLabelText(/Odômetro final \(km\)/i);
    await user.type(campoOdometro, "38342,5");
    expect(screen.getByRole("status")).toHaveTextContent("42,5 km");

    await user.upload(
      screen.getByLabelText(/Foto do painel do odômetro/i),
      criarArquivoImagem("painel-retorno.jpg"),
    );
    await screen.findByText(/Foto anexada/i);

    // Marca problema apenas no item que teve avaria
    await user.click(screen.getByRole("button", { name: /Integridade externa e pneus/i }));
    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e concluir" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Descreva a ocorrência");
    expect(apiRequest).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText(/Descrição da ocorrência ou avaria/i),
      "Arranhão identificado no para-choque traseiro",
    );
    await user.upload(
      screen.getByLabelText(/Foto da avaria ou ocorrência/i),
      criarArquivoImagem("avaria.jpg"),
    );
    await screen.findAllByText(/Foto anexada/i);

    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e concluir" }));

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(apiRequest).mock.calls[0]!;
    expect(url).toBe(`/solicitacoes/${viagemBase.id}/concluir`);
    const enviado = JSON.parse(String(options?.body));
    expect(enviado).toMatchObject({
      kmFinal: 38342.5,
      checklistRetorno: {
        pneusLataria: false,
        estacionadoLocalCorreto: true,
        limpezaInterna: true,
        documentosChaveDevolvidos: true,
        fotoOdometro: expect.stringMatching(/^data:image\/jpeg;base64,/),
        semOcorrencias: false,
        ocorrencias: "Arranhão identificado no para-choque traseiro",
        fotoAvaria: expect.stringMatching(/^data:image\/jpeg;base64,/),
      },
    });
    expect(onConcluido).toHaveBeenCalledWith(
      "Viagem SV-2026-0042 concluída com sucesso.",
      expect.objectContaining({ status: "CONCLUIDA" }),
    );
  });

  it("bloqueia fechamento por Escape/botões durante o envio e preserva dados se a API falhar", async () => {
    const user = userEvent.setup();
    let rejeitarRequisicao!: (erro: Error) => void;
    vi.mocked(apiRequest).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejeitarRequisicao = reject;
        }),
    );

    render(
      <ChecklistViagemModal
        modo="SAIDA"
        viagem={viagemBase}
        onClose={onClose}
        onConcluido={onConcluido}
      />,
    );

    await user.upload(
      screen.getByLabelText(/Foto do painel do odômetro/i),
      criarArquivoImagem("painel.jpg"),
    );
    await screen.findByText(/Foto anexada/i);
    await user.click(screen.getByRole("button", { name: "Confirmar vistoria e iniciar" }));

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(apiRequest).toHaveBeenCalledTimes(1);

    rejeitarRequisicao(new Error("Veículo indisponível para iniciar viagem."));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Veículo indisponível para iniciar viagem.",
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });
});
