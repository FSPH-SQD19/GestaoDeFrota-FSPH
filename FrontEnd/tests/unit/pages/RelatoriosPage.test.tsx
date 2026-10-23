import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../../../src/contexts/AuthContext";
import { RelatoriosPage } from "../../../src/pages/relatorios/RelatoriosPage";

function renderPage() {
  return render(
    <AuthProvider>
      <RelatoriosPage />
    </AuthProvider>,
  );
}

describe("RelatoriosPage", () => {
  it("mostra a saudação, o período e os indicadores do protótipo", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Olá, Gestor!" })).toBeInTheDocument();
    expect(screen.getByText("01-30 set 2026")).toBeInTheDocument();
    expect(screen.getAllByText("6.140").length).toBeGreaterThan(0);
    expect(screen.getByText("614L")).toBeInTheDocument();
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("15 em aberto")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("lista os veículos e marca as coletas do SVO", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Detalhamento por veículo" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(6);
    for (const codigo of ["FSPH-001", "FSPH-002", "FSPH-003", "FSPH-004", "SVO-001"]) {
      expect(screen.getAllByText(codigo).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("coletas")).toBeInTheDocument();
  });

  it("guarda o período escolhido no rótulo sem alterar os indicadores", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "01-30 set 2026" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2026-10-15" } });
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByRole("button", { name: "01-15 out 2026" })).toBeInTheDocument();
    expect(screen.getAllByText("6.140").length).toBeGreaterThan(0);
  });

  it("troca o gráfico conforme a informação", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Participação de km por frota" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Veículo" }));
    expect(screen.getByRole("heading", { name: "Quilometragem por veículo" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Motorista" }));
    expect(screen.getByRole("heading", { name: "Viagens por motorista" })).toBeInTheDocument();
    expect(screen.getByText("Carlos Alberto Santos")).toBeInTheDocument();
  });

  it("oferece a exportação da tabela", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
  });
});
