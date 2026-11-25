import { describe, expect, it } from "vitest";
import {
  ehSolicitanteExternoSomente,
  filtrarHistoricoPublicoSeguro,
  montarMensagemPublicaComplementacao,
  montarMensagemPublicaTriagem,
  sanitizarMensagemPublicaSvo,
  serializarChamadoParaSolicitanteExterno,
} from "../../src/service/svo_historico_lgpd_s";

describe("SVO — Isolamento, LGPD e Histórico Público", () => {
  it("identifica solicitante externo sem perfil operacional", () => {
    expect(ehSolicitanteExternoSomente(["SOLICITANTE_EXTERNO"])).toBe(true);
    expect(ehSolicitanteExternoSomente(["SOLICITANTE_EXTERNO", "SVO"])).toBe(false);
    expect(ehSolicitanteExternoSomente(["ADMIN"])).toBe(false);
  });

  it("bloqueia acesso a chamado de outro solicitante externo", () => {
    const resultado = serializarChamadoParaSolicitanteExterno(
      {
        id: "chamado-1",
        numeroProtocolo: "SVO-2026-0001",
        solicitanteId: "usuario-dono",
        statusTriagem: "EM_ANALISE",
        nomeFalecido: "Fulano de Tal",
        enderecoOcorrencia: "Rua das Flores, 123",
        relatoOcorrencia: "Relato confidencial",
      },
      "outro-usuario",
    );

    expect(resultado).toBeNull();
  });

  it("retorna apenas campos públicos e histórico seguro com timestamps para o dono da solicitação", () => {
    const dataEvento = new Date("2026-11-24T14:30:00.000Z");
    const resultado = serializarChamadoParaSolicitanteExterno(
      {
        id: "chamado-1",
        numeroProtocolo: "SVO-2026-0001",
        solicitanteId: "usuario-dono",
        statusTriagem: "APROVADO",
        statusOperacao: "AGUARDANDO_DESPACHO",
        criadoEm: dataEvento,
        nomeFalecido: "Fulano de Tal",
        enderecoOcorrencia: "Rua das Flores, 123",
        relatoOcorrencia: "Relato interno sensível",
        justificativaTriagem: "Parecer técnico interno",
        historico: [
          {
            id: "hist-1",
            etapa: "ENVIADO",
            mensagemPublica: "Solicitação SVO-2026-0001 enviada e encaminhada para triagem.",
            parecerInterno: "Observação interna da central",
            visivelSolicitante: true,
            criadoEm: dataEvento,
          },
          {
            id: "hist-2",
            etapa: "NOTA_INTERNA",
            mensagemPublica: "Nota restrita",
            visivelSolicitante: false,
            criadoEm: dataEvento,
          },
        ],
      },
      "usuario-dono",
    );

    expect(resultado).toEqual({
      id: "chamado-1",
      numeroProtocolo: "SVO-2026-0001",
      statusTriagem: "APROVADO",
      statusOperacao: "AGUARDANDO_DESPACHO",
      criadoEm: "2026-11-24T14:30:00.000Z",
      historicoPublico: [
        {
          id: "hist-1",
          etapa: "ENVIADO",
          mensagem: "Solicitação SVO-2026-0001 enviada e encaminhada para triagem.",
          registradoEm: "2026-11-24T14:30:00.000Z",
        },
      ],
    });
    expect("nomeFalecido" in (resultado ?? {})).toBe(false);
    expect("enderecoOcorrencia" in (resultado ?? {})).toBe(false);
    expect("relatoOcorrencia" in (resultado ?? {})).toBe(false);
    expect("justificativaTriagem" in (resultado ?? {})).toBe(false);
  });

  it("sanitiza CPF, e-mail e dados sensíveis em mensagens públicas", () => {
    const limpa = sanitizarMensagemPublicaSvo(
      "Contato Maria Silva CPF 123.456.789-00 e-mail maria@exemplo.com",
      ["Maria Silva"],
    );

    expect(limpa).not.toContain("123.456.789-00");
    expect(limpa).not.toContain("maria@exemplo.com");
    expect(limpa).not.toContain("Maria Silva");
    expect(limpa).toContain("[dado protegido - LGPD]");
  });

  it("gera mensagens públicas neutras para triagem e complementação", () => {
    expect(montarMensagemPublicaTriagem("APROVAR")).not.toContain("parecer");
    expect(montarMensagemPublicaComplementacao("SVO-2026-0002")).toBe(
      "Complementação registrada na solicitação SVO-2026-0002.",
    );
    expect(filtrarHistoricoPublicoSeguro([])).toEqual([]);
  });
});
