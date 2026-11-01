import { describe, expect, it } from "vitest";
import {
  interpretarOdometro,
  validarChecklistRetorno,
  validarChecklistSaida,
} from "../../../src/pages/viagens/checklistViagemRules";

const FOTO_TESTE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";

const itensSaidaOk = {
  pneus: true,
  freiosLuzes: true,
  combustivel: true,
  documentos: true,
  limpeza: true,
};

const itensRetornoOk = {
  pneusLataria: true,
  estacionadoLocalCorreto: true,
  limpezaInterna: true,
  documentosChaveDevolvidos: true,
};

describe("checklistViagemRules", () => {
  it("interpreta odômetro válido com ponto ou vírgula e rejeita formatos inválidos", () => {
    expect(interpretarOdometro(" 42510,75 ")).toEqual({ valor: 42510.75, erro: null });
    expect(interpretarOdometro("0")).toEqual({ valor: 0, erro: null });
    expect(interpretarOdometro("100.5")).toEqual({ valor: 100.5, erro: null });

    expect(interpretarOdometro("")).toMatchObject({ valor: null });
    expect(interpretarOdometro("-10")).toMatchObject({ valor: null });
    expect(interpretarOdometro("100,123")).toMatchObject({ valor: null });
    expect(interpretarOdometro("abc")).toMatchObject({ valor: null });
    expect(interpretarOdometro("100000000")).toMatchObject({ valor: null });
  });

  it("valida checklist de saída por exceção exigindo descrição apenas quando há item com problema", () => {
    expect(
      validarChecklistSaida({
        odometroTexto: "38299",
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: itensSaidaOk,
        observacoes: "",
      }),
    ).toMatchObject({
      dados: null,
      erroOdometro: expect.stringContaining("odômetro atual"),
    });

    expect(
      validarChecklistSaida({
        odometroTexto: "38300",
        odometroMinimo: 38300,
        fotoOdometro: null,
        itens: itensSaidaOk,
        observacoes: "",
      }),
    ).toMatchObject({
      dados: null,
      erroFotoOdometro: expect.stringContaining("foto legível"),
    });

    // Item marcado com problema exige descrição
    expect(
      validarChecklistSaida({
        odometroTexto: "38300",
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: { ...itensSaidaOk, limpeza: false },
        observacoes: "",
      }),
    ).toMatchObject({
      dados: null,
      erroGeral: expect.stringContaining("Descreva o problema"),
    });

    // Saída sem problemas (zero cliques nos itens)
    expect(
      validarChecklistSaida({
        odometroTexto: "38300,4",
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: itensSaidaOk,
        observacoes: "",
      }),
    ).toEqual({
      dados: {
        kmInicial: 38300.4,
        checklistSaida: {
          ...itensSaidaOk,
          fotoOdometro: FOTO_TESTE,
        },
      },
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: null,
    });

    // Saída com item irregular + relato + foto da avaria
    const fotoAvaria = "data:image/png;base64,iVBORw0KGgo=";
    expect(
      validarChecklistSaida({
        odometroTexto: "38300",
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: { ...itensSaidaOk, pneus: false },
        observacoes: " Calibragem baixa no pneu traseiro ",
        fotoAvaria,
      }),
    ).toEqual({
      dados: {
        kmInicial: 38300,
        checklistSaida: {
          ...itensSaidaOk,
          pneus: false,
          fotoOdometro: FOTO_TESTE,
          observacoes: "Calibragem baixa no pneu traseiro",
          fotoAvaria,
        },
      },
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: null,
    });
  });

  it("valida checklist de retorno por exceção unificando itens com problema e ocorrências", () => {
    expect(
      validarChecklistRetorno({
        odometroTexto: "38250",
        kmInicial: 38300,
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: itensRetornoOk,
        semOcorrencias: true,
        ocorrencias: "",
      }),
    ).toMatchObject({
      dados: null,
      erroOdometro: expect.stringContaining("maior ou igual ao km inicial"),
    });

    // Item marcado com problema no retorno força exigência de relato e semOcorrencias: false
    expect(
      validarChecklistRetorno({
        odometroTexto: "38385",
        kmInicial: 38300,
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: { ...itensRetornoOk, pneusLataria: false },
        semOcorrencias: true,
        ocorrencias: "ok",
      }),
    ).toMatchObject({
      dados: null,
      erroGeral: expect.stringContaining("Descreva a ocorrência"),
    });

    const fotoAvaria = "data:image/png;base64,iVBORw0KGgo=";
    expect(
      validarChecklistRetorno({
        odometroTexto: "38385,5",
        kmInicial: 38300,
        odometroMinimo: 38300,
        fotoOdometro: FOTO_TESTE,
        itens: { ...itensRetornoOk, pneusLataria: false },
        semOcorrencias: true,
        ocorrencias: " Arranhão identificado no para-choque traseiro ",
        fotoAvaria,
      }),
    ).toEqual({
      dados: {
        kmFinal: 38385.5,
        checklistRetorno: {
          ...itensRetornoOk,
          pneusLataria: false,
          fotoOdometro: FOTO_TESTE,
          semOcorrencias: false,
          ocorrencias: "Arranhão identificado no para-choque traseiro",
          fotoAvaria,
        },
      },
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: null,
    });
  });
});
