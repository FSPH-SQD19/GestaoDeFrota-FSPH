import { describe, expect, it } from "vitest";
import {
  comprimirFotoChecklist,
  TAMANHO_MAXIMO_ARQUIVO_ORIGINAL,
  tamanhoAproximadoKb,
} from "../../../src/pages/viagens/imagemChecklist";

describe("imagemChecklist", () => {
  it("calcula tamanho aproximado em KB a partir do DataURL Base64", () => {
    expect(tamanhoAproximadoKb("invalido")).toBe(0);
    const payload = "A".repeat(4096);
    expect(tamanhoAproximadoKb(`data:image/jpeg;base64,${payload}`)).toBe(3);
  });

  it("rejeita arquivo que não seja imagem", async () => {
    const pdf = new File(["%PDF-1.4"], "documento.pdf", { type: "application/pdf" });
    await expect(comprimirFotoChecklist(pdf)).rejects.toThrow(/arquivo de imagem válido/i);
  });

  it("rejeita arquivo vazio", async () => {
    const vazio = new File([], "vazio.jpg", { type: "image/jpeg" });
    await expect(comprimirFotoChecklist(vazio)).rejects.toThrow(/está vazio/i);
  });

  it("rejeita arquivo acima de 15 MB", async () => {
    const grande = new File(["x"], "grande.jpg", { type: "image/jpeg" });
    Object.defineProperty(grande, "size", { value: TAMANHO_MAXIMO_ARQUIVO_ORIGINAL + 1 });
    await expect(comprimirFotoChecklist(grande)).rejects.toThrow(/15 MB/i);
  });

  it("retorna DataURL válido no fallback sem Canvas 2D", async () => {
    const foto = new File(["bytes-imagem"], "odometro.jpg", { type: "image/jpeg" });
    const dataUrl = await comprimirFotoChecklist(foto);
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});
