import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  clear: vi.fn(),
  reset: vi.fn(),
  handler: vi.fn(),
}));
vi.mock("../../../src/services/api", () => ({
  api: { get: mocks.get, post: mocks.post },
  clearAuthSession: mocks.clear,
  resetCsrf: mocks.reset,
  setUnauthorizedHandler: mocks.handler,
}));
import { AuthProvider } from "../../../src/contexts/AuthContext";
import {
  IDLE_TIMEOUT_MS,
  markBrowserLogout,
  readBrowserSession,
  startBrowserSession,
} from "../../../src/services/browserSession";
import { useAuth } from "../../../src/contexts/auth";
const data = {
  usuario: { id: "u", nome: "Pessoa", email: "teste@example.test", perfis: ["GESTOR"] },
};
function Consumer() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.isLoading ? "carregando" : auth.user?.nome || "desconectado"}</span>
      <button onClick={() => void auth.login({ usuario: "teste@example.test", senha: "senha" })}>
        Entrar
      </button>
      <button onClick={() => void auth.logout()}>Sair</button>
    </>
  );
}
function setup() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}
beforeEach(() => {
  mocks.get.mockResolvedValue({ data });
  mocks.post.mockResolvedValue({ data });
});
describe("sessão por cookie", () => {
  it("restaura pelo servidor sem persistir JWT ou usuário", async () => {
    setup();
    expect(await screen.findByText("Pessoa")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/auth/sessao");
    expect(mocks.clear).toHaveBeenCalled();
    expect(localStorage.getItem("@fsph_frota_token")).toBeNull();
    expect(localStorage.getItem("@fsph_frota_user")).toBeNull();
  });
  it("só confirma logout depois que a API responde", async () => {
    let finish!: () => void;
    mocks.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    setup();
    await screen.findByText("Pessoa");
    await userEvent.click(screen.getByText("Sair"));
    expect(screen.getByText("Pessoa")).toBeInTheDocument();
    await act(async () => finish());
    expect(await screen.findByText("desconectado")).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith("/api/v1/auth/logout");
  });
  it("não informa logout bem-sucedido quando a revogação falha", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    mocks.post.mockRejectedValue(new Error("offline"));
    setup();
    await screen.findByText("Pessoa");
    await userEvent.click(screen.getByText("Sair"));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(screen.getByText("Pessoa")).toBeInTheDocument();
  });
  it("ignora restauração atrasada depois de um novo login", async () => {
    let finish!: () => void;
    mocks.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ data: { usuario: { ...data.usuario, nome: "Antigo" } } });
        }),
    );
    setup();
    await userEvent.click(screen.getByText("Entrar"));
    expect(await screen.findByText("Pessoa")).toBeInTheDocument();
    await act(async () => finish());
    expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
    expect(mocks.reset).toHaveBeenCalled();
  });
});

afterEach(() => vi.useRealTimers());
describe("logout por inatividade", () => {
  it("oculta a sessão aos 30 minutos mesmo offline e tenta revogar ao reconectar", async () => {
    mocks.post.mockRejectedValue(new Error("offline"));
    vi.useFakeTimers();
    setup();
    await act(async () => {});
    expect(screen.getByText("Pessoa")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);
    });
    expect(screen.getByText("desconectado")).toBeInTheDocument();
    expect(readBrowserSession()?.status).toBe("pending");
    mocks.post.mockResolvedValue({});
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(readBrowserSession()?.status).toBe("ended");
  });
  it("não restaura sessão que ficou inativa enquanto a página estava fechada", async () => {
    vi.useFakeTimers();
    startBrowserSession();
    vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + 1);
    setup();
    await act(async () => {});
    expect(screen.getByText("desconectado")).toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith("/api/v1/auth/logout");
  });
  it("tenta concluir revogação pendente ao reabrir a página", async () => {
    markBrowserLogout(true);
    setup();
    await act(async () => {});
    expect(screen.getByText("desconectado")).toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(readBrowserSession()?.status).toBe("ended");
  });
});
