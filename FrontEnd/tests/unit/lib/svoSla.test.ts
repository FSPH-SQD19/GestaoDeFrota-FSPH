import { describe, expect, it } from "vitest";
import { chamadoAbertoParaSla, formatarDuracaoSla, minutosDesde } from "../../../src/lib/svoSla";

describe("svoSla", () => {
  it("formata minutos, horas e ausência de média", () => {
    expect(formatarDuracaoSla(null)).toBe("—");
    expect(formatarDuracaoSla(18)).toBe("18 min");
    expect(formatarDuracaoSla(75)).toBe("1 h 15 min");
    expect(formatarDuracaoSla(120)).toBe("2 h");
  });

  it("calcula o tempo decorrido e ignora chamados encerrados", () => {
    expect(minutosDesde("2026-11-10T12:00:00.000Z", Date.parse("2026-11-10T12:18:00.000Z"))).toBe(
      18,
    );
    expect(
      chamadoAbertoParaSla({ statusTriagem: "APROVADO", ordemColeta: { status: "NO_LOCAL" } }),
    ).toBe(true);
    expect(
      chamadoAbertoParaSla({ statusTriagem: "APROVADO", ordemColeta: { status: "ENTREGUE_SVO" } }),
    ).toBe(false);
  });
});
