export const TAMANHO_MAXIMO_ARQUIVO_ORIGINAL = 15 * 1024 * 1024; // 15 MB
export const LIMITE_CARACTERES_DATA_URL = 160_000; // ~115 KB em Base64
const DIMENSAO_MAXIMA_PX = 960;
const QUALIDADES_TENTATIVA = [0.72, 0.56, 0.42] as const;

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string" && leitor.result.startsWith("data:image/")) {
        resolve(leitor.result);
      } else {
        reject(new Error("Não foi possível ler a imagem selecionada."));
      }
    };
    leitor.onerror = () => reject(new Error("Falha ao carregar o arquivo de imagem."));
    leitor.readAsDataURL(arquivo);
  });
}

function carregarElementoImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error("Não foi possível abrir esta imagem. Tire outra foto ou selecione outra imagem."),
      );
    img.src = src;
  });
}

function obterContextoCanvas(
  largura: number,
  altura: number,
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  try {
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
  } catch {
    return null;
  }
}

export function tamanhoAproximadoKb(dataUrl: string): number {
  const indiceBase64 = dataUrl.indexOf(",");
  if (indiceBase64 < 0) return 0;
  const bytes = Math.round(((dataUrl.length - indiceBase64 - 1) * 3) / 4);
  return Math.max(1, Math.round(bytes / 1024));
}

export async function comprimirFotoChecklist(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido (foto da câmera ou galeria).");
  }
  if (arquivo.size <= 0) {
    throw new Error(
      "Não foi possível usar esta imagem. Tire outra foto ou selecione outra imagem.",
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_ORIGINAL) {
    throw new Error("A imagem excede o limite de 15 MB. Tire uma nova foto.");
  }

  const dataUrlOriginal = await lerComoDataUrl(arquivo);

  // Navegadores sem Canvas só podem enviar imagens que já cabem no limite.
  const sondaCanvas = obterContextoCanvas(1, 1);
  if (!sondaCanvas) {
    if (dataUrlOriginal.length > LIMITE_CARACTERES_DATA_URL) {
      throw new Error(
        "A foto é muito grande para envio. Tire outra foto ou selecione uma imagem menor.",
      );
    }
    return dataUrlOriginal;
  }

  const img = await carregarElementoImagem(dataUrlOriginal);
  const larguraOriginal = img.naturalWidth || img.width || DIMENSAO_MAXIMA_PX;
  const alturaOriginal = img.naturalHeight || img.height || DIMENSAO_MAXIMA_PX;
  const escala = Math.min(1, DIMENSAO_MAXIMA_PX / Math.max(larguraOriginal, alturaOriginal));
  const largura = Math.max(1, Math.round(larguraOriginal * escala));
  const altura = Math.max(1, Math.round(alturaOriginal * escala));

  const superficie = obterContextoCanvas(largura, altura);
  if (!superficie) return dataUrlOriginal;

  superficie.ctx.fillStyle = "#ffffff";
  superficie.ctx.fillRect(0, 0, largura, altura);
  superficie.ctx.drawImage(img, 0, 0, largura, altura);

  let resultado = dataUrlOriginal;
  for (const qualidade of QUALIDADES_TENTATIVA) {
    resultado = superficie.canvas.toDataURL("image/jpeg", qualidade);
    if (resultado.length <= LIMITE_CARACTERES_DATA_URL) {
      return resultado;
    }
  }

  // Redução adicional de dimensões caso ainda ultrapasse o orçamento de payload.
  const superficieCompacta = obterContextoCanvas(
    Math.max(1, Math.round(largura * 0.7)),
    Math.max(1, Math.round(altura * 0.7)),
  );
  if (superficieCompacta) {
    superficieCompacta.ctx.fillStyle = "#ffffff";
    superficieCompacta.ctx.fillRect(
      0,
      0,
      superficieCompacta.canvas.width,
      superficieCompacta.canvas.height,
    );
    superficieCompacta.ctx.drawImage(
      img,
      0,
      0,
      superficieCompacta.canvas.width,
      superficieCompacta.canvas.height,
    );
    resultado = superficieCompacta.canvas.toDataURL("image/jpeg", 0.45);
  }

  if (resultado.length > LIMITE_CARACTERES_DATA_URL) {
    throw new Error(
      "A foto é muito grande para envio. Tire outra foto ou selecione uma imagem menor.",
    );
  }
  return resultado;
}
