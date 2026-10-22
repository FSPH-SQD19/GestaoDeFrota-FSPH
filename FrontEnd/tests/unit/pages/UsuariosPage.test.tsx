import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UsuariosPage } from "../../../src/pages/usuarios/UsuariosPage";

describe("UsuariosPage", () => {
  it("lista os usuários do protótipo", () => {
    render(<UsuariosPage />);

    expect(screen.getByRole("heading", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("Laudelino Santos")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("filtra a busca por nome", async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    await user.type(screen.getByLabelText("Buscar usuário"), "Micaela");

    expect(screen.getByText("Micaela Santos")).toBeInTheDocument();
    expect(screen.queryByText("Laudelino Santos")).not.toBeInTheDocument();
  });

  it("filtra por setor", async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await user.click(screen.getByRole("button", { name: "LACEN" }));

    expect(screen.getByText("João Francisco")).toBeInTheDocument();
    expect(screen.queryByText("Vitor")).not.toBeInTheDocument();
  });

  it("inclui um usuário criado no formulário", async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    await user.type(screen.getByLabelText("Nome"), "Marina Costa");
    await user.type(screen.getByLabelText("Telefone"), "(79)9999-0000");
    await user.type(screen.getByLabelText("E-mail"), "marina.costa@fsph.se.gov.br");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Marina Costa")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(8);
  });
});
