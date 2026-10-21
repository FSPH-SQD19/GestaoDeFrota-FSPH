import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "../../../src/components/common/Input";

describe("Input", () => {
  it("alterna a visibilidade da senha sem perder o valor digitado", async () => {
    const user = userEvent.setup();
    render(<Input label="Senha" type="password" />);
    const input = screen.getByLabelText("Senha");
    await user.type(input, "senha-sintetica");

    await user.click(screen.getByRole("button", { name: "Ver senha" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("senha-sintetica");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("senha-sintetica");
  });

  it("mostra a mensagem de erro em lugar da ajuda e recupera a ajuda apos a correcao", () => {
    const { rerender } = render(
      <Input label="Email" helperText="Use seu email institucional" error="Email invalido" />,
    );

    expect(screen.getByText("Email invalido")).toBeInTheDocument();
    expect(screen.queryByText("Use seu email institucional")).not.toBeInTheDocument();

    rerender(<Input label="Email" helperText="Use seu email institucional" />);
    expect(screen.queryByText("Email invalido")).not.toBeInTheDocument();
    expect(screen.getByText("Use seu email institucional")).toBeInTheDocument();
  });
});
