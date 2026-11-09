import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
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
    const documento = new PDFDocument({ size: "A4", margin: 40 });
    const partes: Buffer[] = [];
    const pronto = new Promise<Buffer>((resolve, reject) => {
      documento.on("data", (parte: Buffer) => partes.push(parte));
      documento.on("end", () => resolve(Buffer.concat(partes)));
      documento.on("error", reject);
    });
    documento.fontSize(18).text(`Relatório de ${tipo}`);
    documento.fontSize(11).text(`${filtro.inicio} a ${filtro.fim}`);
    if (filtro.setor) documento.text(`Setor: ${filtro.setor}`);
    if (tipo === "consumo")
      documento.text("Km/L estimado: km de viagens encerradas / litros abastecidos no período.");
    documento.moveDown();
    if (!linhas.length) documento.text("Sem registros no período.");
    for (const linha of linhas) {
      const texto = colunas
        .map((coluna, i) => `${coluna}: ${linha[i] ?? "Indisponível"}`)
        .join(" | ");
      const altura = documento.heightOfString(texto);
      if (documento.y + altura > documento.page.height - 40) documento.addPage();
      documento.text(texto).moveDown(0.5);
    }
    documento.end();
    return res
      .attachment(`${nome}.pdf`)
      .type("application/pdf")
      .send(await pronto);
  };
}
