import { describe, expect, it } from "vitest";
import { intervalosLivres, type Ocupacao } from "../../../src/pages/solicitacoes/agendaIntervalos";

const hora = (valor: string) => `2026-11-10T${valor}:00.000Z`;

function ocupacao(id: string, inicio: string, fim: string): Ocupacao {
  return {
    id,
    inicio: hora(inicio),
    fim: hora(fim),
    veiculoId: "veiculo",
    motoristaId: null,
    tipo: "MANUTENCAO",
    motivo: null,
  };
}

describe("intervalosLivres", () => {
  it("desconta bloqueios sobrepostos e contíguos sem criar lacunas nas bordas", () => {
    const livres = intervalosLivres(hora("08:00"), hora("18:00"), [
      ocupacao("final", "16:00", "20:00"),
      ocupacao("inicio", "07:00", "09:00"),
      ocupacao("contigua", "11:00", "12:00"),
      ocupacao("principal", "09:00", "11:00"),
      ocupacao("sobreposta", "10:00", "13:00"),
    ]);

    expect(livres).toEqual([
      expect.objectContaining({ tipo: "LIVRE", inicio: hora("13:00"), fim: hora("16:00") }),
    ]);
  });

  it("libera o período inteiro quando não há ocupações", () => {
    const inicio = hora("08:00");
    const fim = hora("18:00");
    expect(intervalosLivres(inicio, fim, [])).toEqual([
      expect.objectContaining({ tipo: "LIVRE", inicio, fim }),
    ]);
  });
});
