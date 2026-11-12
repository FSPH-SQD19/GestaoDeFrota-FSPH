import type { Request, Response } from "express";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { validar } from "../lib/validar";
import { HttpError } from "../lib/http_error";
import {
  agregarConsumo,
  agregarManutencoes,
  agregarViagens,
  filtroAgregacaoSchema,
} from "../service/relatorio_agregacao_s";

const agregadores = {
  consumo: agregarConsumo,
  manutencoes: agregarManutencoes,
  viagens: agregarViagens,
};

export function relatorioAgregadoController(tipo: keyof typeof agregadores) {
  return async (req: Request, res: Response) => {
    const filtro = validar(filtroAgregacaoSchema, req.query);
    if (filtro.setor && tipo !== "viagens") {
      throw new HttpError(400, "O filtro de setor está disponível apenas para viagens.");
    }
    const dados = await agregadores[tipo](filtro);
    const nome = `${tipo}_${filtro.inicio}_${filtro.fim}`;
    if (filtro.formato === "json") {
      return res.json({
        inicio: filtro.inicio,
        fim: filtro.fim,
        setor: filtro.setor ?? null,
        dados,
      });
    }
    const colunas =
      tipo === "consumo"
        ? ["placa", "modelo", "kmRodados", "litrosAbastecidos", "consumoMedioKmL"]
        : tipo === "manutencoes"
          ? ["tipo", "status", "quantidade", "custoTotal"]
          : ["setor", "status", "viagens"];
    const linhas = dados.map((r) => colunas.map((c) => (r as Record<string, unknown>)[c]));
    if (filtro.formato === "csv") {
      const escapar = (valor: unknown) => {
        const texto = valor == null ? "" : String(valor);
        const seguro = /^\s*[=+@-]/.test(texto) || /^[\t\r\n]/.test(texto) ? `'${texto}` : texto;
        return `"${seguro.replaceAll('"', '""')}"`;
      };
      return res
        .attachment(`${nome}.csv`)
        .type("text/csv; charset=utf-8")
        .send(
          "\uFEFF" + [colunas, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\r\n"),
        );
    }
    const documento = await PDFDocument.create();
    const fonte = await documento.embedFont(StandardFonts.Helvetica);
    let pagina = documento.addPage([595.28, 841.89]);
    let y = pagina.getHeight() - 40;
    const escrever = (texto: string, tamanho = 11) => {
      // A fonte padrão usa WinAnsi; caracteres não suportados não devem invalidar o relatório.
      const seguro = Array.from(texto, (caractere) => {
        try {
          fonte.encodeText(caractere);
          return caractere;
        } catch {
          return "?";
        }
      }).join("");
      let trecho = "";
      const desenhar = () => {
        if (y < 40 + tamanho) {
          pagina = documento.addPage([595.28, 841.89]);
          y = pagina.getHeight() - 40;
        }
        pagina.drawText(trecho, { x: 40, y: y - tamanho, size: tamanho, font: fonte });
        y -= tamanho * 1.4;
      };
      for (const caractere of seguro) {
        if (fonte.widthOfTextAtSize(trecho + caractere, tamanho) > pagina.getWidth() - 80) {
          desenhar();
          trecho = "";
        }
        trecho += caractere;
      }
      if (trecho) desenhar();
    };
    escrever(`Relatório de ${tipo}`, 18);
    escrever(`${filtro.inicio} a ${filtro.fim}`);
    if (filtro.setor) escrever(`Setor: ${filtro.setor}`);
    if (tipo === "consumo")
      escrever("Km/L estimado: km de viagens encerradas / litros abastecidos no período.");
    y -= 10;
    if (!linhas.length) escrever("Sem registros no período.");
    for (const linha of linhas) {
      const texto = colunas
        .map((coluna, i) => `${coluna}: ${linha[i] ?? "Indisponível"}`)
        .join(" | ");
      escrever(texto);
      y -= 5;
    }
    return res
      .attachment(`${nome}.pdf`)
      .type("application/pdf")
      .send(Buffer.from(await documento.save()));
  };
}
