import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comprimirFotoChecklist,
  TAMANHO_MAXIMO_ARQUIVO_ORIGINAL,
  tamanhoAproximadoKb,
  LIMITE_CARACTERES_DATA_URL,
} from "../../../src/pages/viagens/imagemChecklist";

afterEach(() => vi.unstubAllGlobals());

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
    await expect(comprimirFotoChecklist(vazio)).rejects.toThrow(
      "Não foi possível usar esta imagem. Tire outra foto ou selecione outra imagem.",
    );
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

  it("rejeita foto que excede o limite quando Canvas não está disponível", async () => {
    const foto = new File(["x".repeat(LIMITE_CARACTERES_DATA_URL)], "grande.jpg", {
      type: "image/jpeg",
    });
    await expect(comprimirFotoChecklist(foto)).rejects.toThrow("A foto é muito grande para envio.");
  });

  it("redimensiona e ajusta a qualidade com Canvas disponível, inclusive no ambiente de testes", async () => {
    class ImagemTeste {
      naturalWidth = 1920;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      set src(_valor: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", ImagemTeste);
    const contexto = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      contexto as unknown as CanvasRenderingContext2D,
    );
    const esperado = "data:image/jpeg;base64,aW1hZ2Vt";
    const codificar = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValueOnce("x".repeat(LIMITE_CARACTERES_DATA_URL + 1))
      .mockReturnValue(esperado);
    const foto = new File(["imagem-original"], "foto.png", { type: "image/png" });
    expect(await comprimirFotoChecklist(foto)).toBe(esperado);
    expect(contexto.drawImage).toHaveBeenCalledWith(expect.any(ImagemTeste), 0, 0, 960, 540);
    expect(codificar).toHaveBeenNthCalledWith(1, "image/jpeg", 0.72);
    expect(codificar).toHaveBeenNthCalledWith(2, "image/jpeg", 0.56);
  });
});
