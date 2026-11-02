import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../../../src/components/layout/Header";
import { AuthContext } from "../../../src/contexts/auth";
import { apiRequest } from "../../../src/lib/api";

vi.mock("../../../src/lib/api", () => ({ apiRequest: vi.fn() }));

const logoutMock = vi.fn();

function renderizarHeader() {
  return render(
    <AuthContext.Provider
      value={{
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          nome: "Bruno Santana",
          email: "bruno@fsph.se.gov.br",
          roles: ["GESTOR"],
        },
        sessionKey: "sessao-teste",
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: logoutMock,
        hasRole: (roles) => roles.includes("GESTOR"),
      }}
    >
      <Header />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  logoutMock.mockResolvedValue(undefined);
});

describe("Header e MinhaContaModal", () => {
  it("abre o menu da conta no Header, valida campos e envia PATCH /auth/alterar-senha", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(apiRequest).mockResolvedValueOnce({ mensagem: "Senha alterada com sucesso." });

    renderizarHeader();

    await user.click(screen.getByRole("button", { name: "Menu da conta" }));
    await user.click(screen.getByRole("menuitem", { name: /Minha Conta \/ Alterar Senha/i }));

    expect(screen.getByRole("heading", { name: "Minha Conta" })).toBeInTheDocument();
    expect(screen.getByText("bruno@fsph.se.gov.br")).toBeInTheDocument();

    const campoAtual = screen.getByLabelText(/Senha atual/i);
    const campoNova = screen.getByLabelText(/^Nova senha/i);
    const campoConfirmar = screen.getByLabelText(/Confirmar nova senha/i);

    // Valida senha curta
    fireEvent.change(campoAtual, { target: { value: "Gestor@123" } });
    fireEvent.change(campoNova, { target: { value: "curta" } });
    fireEvent.change(campoConfirmar, { target: { value: "curta" } });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();

    // Valida confirmação divergente
    fireEvent.change(campoNova, { target: { value: "NovaSenha@2026" } });
    fireEvent.change(campoConfirmar, { target: { value: "OutraSenha@2026" } });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByText(/confirmação não coincide/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();

    // Fluxo válido
    fireEvent.change(campoConfirmar, { target: { value: "NovaSenha@2026" } });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(apiRequest).toHaveBeenCalledWith("/auth/alterar-senha", {
      method: "PATCH",
      body: JSON.stringify({
        senhaAtual: "Gestor@123",
        novaSenha: "NovaSenha@2026",
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada com sucesso.");
    expect(campoAtual).toHaveValue("");
    expect(campoNova).toHaveValue("");
    expect(campoConfirmar).toHaveValue("");
  });

  it("exibe erro no campo de senha atual quando a API informa senha atual incorreta", async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("A senha atual informada está incorreta."),
    );

    renderizarHeader();
    await user.click(screen.getByRole("button", { name: "Menu da conta" }));
    await user.click(screen.getByRole("menuitem", { name: /Minha Conta \/ Alterar Senha/i }));

    fireEvent.change(screen.getByLabelText(/Senha atual/i), {
      target: { value: "SenhaErrada@123" },
    });
    fireEvent.change(screen.getByLabelText(/^Nova senha/i), {
      target: { value: "NovaSenha@2026" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar nova senha/i), {
      target: { value: "NovaSenha@2026" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("A senha atual informada está incorreta.")).toBeInTheDocument();
  });

  it("permite acionar logout pelo menu do Header", async () => {
    const user = userEvent.setup({ delay: null });
    renderizarHeader();

    await user.click(screen.getByRole("button", { name: "Menu da conta" }));
    await user.click(screen.getByRole("menuitem", { name: "Sair da conta" }));

    expect(logoutMock).toHaveBeenCalledOnce();
  });
});
