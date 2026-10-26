import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { SolicitacoesPage } from "../../../src/pages/solicitacoes/SolicitacoesPage";

function renderPage() {
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

describe("SolicitacoesPage (visão do solicitante)", () => {
  it("lista as solicitações e mostra os indicadores", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Minhas Solicitações de Viagem" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SV-2026-0142")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6); // cabeçalho + 5 solicitações
  });

  it("filtra por status recusada", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Recusadas" }));

    expect(screen.getByText("SV-2026-0098")).toBeInTheDocument();
    expect(screen.queryByText("SV-2026-0142")).not.toBeInTheDocument();
  });

  it("exibe erros de validação ao enviar o formulário vazio", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Nova Solicitação de Viagem" }));
    await user.click(screen.getByRole("button", { name: "Enviar Solicitação" }));

    expect(await screen.findByText("Informe o local de partida.")).toBeInTheDocument();
    expect(screen.getByText("Informe o destino da viagem.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data e hora de saída.")).toBeInTheDocument();
  });

  it("cria uma nova solicitação pendente com dados válidos", async () => {
    const user = userEvent.setup();
    renderPage();

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
    expect(aviso).toHaveTextContent(/enviada/i);
    expect(screen.getByText("Hospital de Propriá")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("mostra veículo e motorista nos detalhes de uma viagem aprovada", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "Ver detalhes da solicitação SV-2026-0137" }),
    );

    const dialogo = screen
      .getByText("Solicitação SV-2026-0137")
      .closest("div.relative") as HTMLElement;
    expect(within(dialogo).getByText("BRA-2E19")).toBeInTheDocument();
    expect(within(dialogo).getByText("Carlos Alberto")).toBeInTheDocument();
  });
});
