import type {
  ChecklistRetornoPayload,
  ChecklistSaidaPayload,
  ConcluirViagemInput,
  IniciarViagemInput,
} from "../../types/solicitacao";

export const ODOMETRO_MAXIMO = 99_999_999.99;

export type ChaveItemSaida = Exclude<
  keyof ChecklistSaidaPayload,
  "observacoes" | "fotoOdometro" | "fotoAvaria"
>;
export type ChaveItemRetorno = Exclude<
  keyof ChecklistRetornoPayload,
  "semOcorrencias" | "ocorrencias" | "fotoOdometro" | "fotoAvaria"
>;

export interface ItemChecklistDefinicao<Chave extends string> {
  chave: Chave;
  titulo: string;
  descricao: string;
}

export const ITENS_CHECKLIST_SAIDA: readonly ItemChecklistDefinicao<ChaveItemSaida>[] = [
  {
    chave: "pneus",
    titulo: "Pneus e estepe",
    descricao: "Calibragem adequada, sem cortes visíveis e estepe presente.",
  },
  {
    chave: "freiosLuzes",
    titulo: "Freios, faróis e sinalização",
    descricao: "Faróis, setas, luz de freio e painel sem alertas críticos.",
  },
  {
    chave: "combustivel",
    titulo: "Nível de combustível e fluidos",
    descricao: "Combustível suficiente para o trajeto e sem vazamentos aparentes.",
  },
  {
    chave: "documentos",
    titulo: "Documentação e equipamentos",
    descricao: "CRLV vigente no veículo, chave reserva/cartão e itens obrigatórios.",
  },
  {
    chave: "limpeza",
    titulo: "Higiene e conservação interna",
    descricao: "Interior limpo e adequado para o transporte institucional.",
  },
];

export const ITENS_CHECKLIST_RETORNO: readonly ItemChecklistDefinicao<ChaveItemRetorno>[] = [
  {
    chave: "pneusLataria",
    titulo: "Integridade externa e pneus",
    descricao: "Lataria, vidros, retrovisores e pneus conferidos após o retorno.",
  },
  {
    chave: "estacionadoLocalCorreto",
    titulo: "Veículo estacionado no pátio",
    descricao: "Estacionado em vaga institucional com freio de estacionamento acionado.",
  },
  {
    chave: "limpezaInterna",
    titulo: "Interior livre de objetos e resíduos",
    descricao: "Nenhum material, documento ou pertence deixado nos bancos/porta-malas.",
  },
  {
    chave: "documentosChaveDevolvidos",
    titulo: "Chave e documentos entregues",
    descricao: "Chave e pasta do veículo devolvidas ao controle da frota.",
  },
];

const PADRAO_ODOMETRO = /^\d+(?:[.,]\d{1,2})?$/;

export function normalizarNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function interpretarOdometro(texto: string): { valor: number | null; erro: string | null } {
  const limpo = texto.trim();
  if (!limpo) {
    return { valor: null, erro: "Informe a leitura atual do odômetro." };
  }
  if (limpo.startsWith("-")) {
    return { valor: null, erro: "O odômetro não pode ser negativo." };
  }
  if (!PADRAO_ODOMETRO.test(limpo)) {
    return { valor: null, erro: "Informe um valor numérico válido com até 2 casas decimais." };
  }
  const numero = Number(limpo.replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) {
    return { valor: null, erro: "Informe um valor numérico válido para o odômetro." };
  }
  if (numero > ODOMETRO_MAXIMO) {
    return { valor: null, erro: "O odômetro informado excede o limite permitido." };
  }
  return { valor: Math.round(numero * 100) / 100, erro: null };
}

export interface ResultadoValidacaoSaida {
  dados: IniciarViagemInput | null;
  erroOdometro: string | null;
  erroFotoOdometro: string | null;
  erroGeral: string | null;
}

export interface ResultadoValidacaoRetorno {
  dados: ConcluirViagemInput | null;
  erroOdometro: string | null;
  erroFotoOdometro: string | null;
  erroGeral: string | null;
}

export function validarChecklistSaida(params: {
  odometroTexto: string;
  odometroMinimo: number | null;
  fotoOdometro: string | null;
  itens: Record<ChaveItemSaida, boolean>;
  observacoes: string;
  fotoAvaria?: string | null;
}): ResultadoValidacaoSaida {
  const { valor, erro } = interpretarOdometro(params.odometroTexto);
  if (erro || valor === null) {
    return { dados: null, erroOdometro: erro, erroFotoOdometro: null, erroGeral: null };
  }
  if (params.odometroMinimo !== null && valor < params.odometroMinimo) {
    return {
      dados: null,
      erroOdometro: "Km inicial não pode ser menor que o odômetro atual do veículo.",
      erroFotoOdometro: null,
      erroGeral: null,
    };
  }
  const fotoOdometro = params.fotoOdometro?.trim() ?? "";
  if (!fotoOdometro.startsWith("data:image/")) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: "Anexe uma foto legível do painel do odômetro.",
      erroGeral: null,
    };
  }
  const temProblema = ITENS_CHECKLIST_SAIDA.some(({ chave }) => !params.itens[chave]);
  const observacoes = params.observacoes.trim();
  if (temProblema && observacoes.length < 5) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: "Descreva o problema identificado nos itens marcados (mín. 5 caracteres).",
    };
  }
  if (observacoes.length > 300) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: "As observações de saída devem ter no máximo 300 caracteres.",
    };
  }
  const fotoAvaria = params.fotoAvaria?.trim() ?? "";
  return {
    dados: {
      kmInicial: valor,
      checklistSaida: {
        ...params.itens,
        fotoOdometro,
        ...(observacoes ? { observacoes } : {}),
        ...(temProblema && fotoAvaria.startsWith("data:image/") ? { fotoAvaria } : {}),
      },
    },
    erroOdometro: null,
    erroFotoOdometro: null,
    erroGeral: null,
  };
}

export function validarChecklistRetorno(params: {
  odometroTexto: string;
  kmInicial: number | null;
  odometroMinimo: number | null;
  fotoOdometro: string | null;
  itens: Record<ChaveItemRetorno, boolean>;
  semOcorrencias: boolean;
  ocorrencias: string;
  fotoAvaria?: string | null;
}): ResultadoValidacaoRetorno {
  const { valor, erro } = interpretarOdometro(params.odometroTexto);
  if (erro || valor === null) {
    return { dados: null, erroOdometro: erro, erroFotoOdometro: null, erroGeral: null };
  }
  if (params.kmInicial !== null && valor < params.kmInicial) {
    return {
      dados: null,
      erroOdometro: "Km final deve ser maior ou igual ao km inicial registrado na saída.",
      erroFotoOdometro: null,
      erroGeral: null,
    };
  }
  if (params.odometroMinimo !== null && valor < params.odometroMinimo) {
    return {
      dados: null,
      erroOdometro: "Km final não pode ser menor que o odômetro atual do veículo.",
      erroFotoOdometro: null,
      erroGeral: null,
    };
  }
  const fotoOdometro = params.fotoOdometro?.trim() ?? "";
  if (!fotoOdometro.startsWith("data:image/")) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: "Anexe uma foto legível do painel do odômetro.",
      erroGeral: null,
    };
  }
  const temProblemaItens = ITENS_CHECKLIST_RETORNO.some(({ chave }) => !params.itens[chave]);
  const possuiOcorrencia = temProblemaItens || !params.semOcorrencias;
  const ocorrencias = params.ocorrencias.trim();
  if (possuiOcorrencia && ocorrencias.length < 5) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral:
        "Descreva a ocorrência ou o problema identificado nos itens marcados (mín. 5 caracteres).",
    };
  }
  if (ocorrencias.length > 500) {
    return {
      dados: null,
      erroOdometro: null,
      erroFotoOdometro: null,
      erroGeral: "O relato de ocorrências deve ter no máximo 500 caracteres.",
    };
  }
  const fotoAvaria = params.fotoAvaria?.trim() ?? "";
  return {
    dados: {
      kmFinal: valor,
      checklistRetorno: {
        ...params.itens,
        fotoOdometro,
        semOcorrencias: !possuiOcorrencia,
        ...(possuiOcorrencia && ocorrencias ? { ocorrencias } : {}),
        ...(possuiOcorrencia && fotoAvaria.startsWith("data:image/") ? { fotoAvaria } : {}),
      },
    },
    erroOdometro: null,
    erroFotoOdometro: null,
    erroGeral: null,
  };
}
