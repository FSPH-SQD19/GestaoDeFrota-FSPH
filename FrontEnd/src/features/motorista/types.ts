export type Coordenadas = [number, number];
export const ITENS = [
  "pneus",
  "iluminacao",
  "freios",
  "fluidos",
  "equipamentos",
  "limpeza",
] as const;
export const LABELS = {
  pneus: "Pneus",
  iluminacao: "Iluminação",
  freios: "Freios",
  fluidos: "Fluidos",
  equipamentos: "Equipamentos e documentos",
  limpeza: "Limpeza",
};
export type Checklist = {
  versao: 1;
  itens: Record<(typeof ITENS)[number], { estado: "CONFORME" | "PROBLEMA"; observacao: string }>;
};
export const novoChecklist = (): Checklist => ({
  versao: 1,
  itens: Object.fromEntries(
    ITENS.map((k) => [k, { estado: "CONFORME", observacao: "" }]),
  ) as Checklist["itens"],
});
export type Ponto = { id: string; nome: string; coordenadas: Coordenadas | null };
export type Saida = {
  id: string;
  motoristaId: string;
  veiculoId: string;
  tipo: "ADMINISTRATIVA" | "SVO";
  status: "EM_ANDAMENTO" | "CONCLUIDA";
  inicio: string;
  fim: string | null;
  kmInicial: string;
  kmFinal: string | null;
  pontos: Ponto[];
  ordens: Array<{ ordemId: string; visitadaEm: string | null }>;
};
export type Veiculo = { id: string; placa: string; modelo: string; odometroAtual: string };
export type Tarefas = {
  motorista: { id: string };
  administrativas: Array<{
    id: string;
    protocolo: string;
    origem: string;
    destino: string;
    dataHoraPretendida?: string | null;
    quantidadePassageiros?: number;
    tipoTransporte?: string;
    origemCoordenadas?: number[];
    destinoCoordenadas?: number[];
    veiculoAlocado: Veiculo | null;
  }>;
  ordens: Array<{
    id: string;
    veiculo: Veiculo | null;
    chamado: { enderecoOcorrencia: string };
    coordenadas: Coordenadas | null;
  }>;
  ativa: Saida | null;
  historico: Saida[];
  sessaoExpiraEm: string | null;
};
export type Comando =
  | { id: string; tipo: "VISITA"; ordemId: string }
  | {
      id: string;
      tipo: "ABASTECIMENTO";
      odometro: number;
      litros: number;
      valorTotal: number;
      dataHora: string;
      fornecedorId?: string;
    }
  | {
      id: string;
      tipo: "ENCERRAR";
      kmFinal: number;
      checklist: Checklist;
      ocorrencias: string;
      dataHora: string;
    };
export type Posicao = {
  id: string;
  coordenadas: Coordenadas;
  capturadaEm: string;
  precisao: number;
  velocidade: number | null;
  direcao: number | null;
};
export type Rota = {
  destino: Ponto;
  geometry: { type: "LineString"; coordinates: Coordenadas[] };
  distancia: number;
  duracao: number;
  instrucoes: Array<{ texto: string; distancia: number }>;
  calculadaEm: string;
};
export type Pendencia = { saidaId: string; comando: Comando; erro?: string };
export type Offline = {
  tarefas?: Tarefas;
  rota?: Rota;
  posicoes: Array<{ saidaId: string; posicao: Posicao }>;
  comandos: Pendencia[];
};
