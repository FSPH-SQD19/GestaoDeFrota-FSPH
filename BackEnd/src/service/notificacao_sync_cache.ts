export type RegistroSincronizacaoUsuario = {
  dia: string;
  timestampMs: number;
};

export type MotoristaSincronizacao = {
  id: string;
  numeroCnh: string;
  validadeCnh: Date;
  usuario?: { nome: string } | null;
};

export type DocumentoAtualSincronizacao = {
  id: string;
  veiculoId: string;
  tipoDocumento: string;
  dataVencimento: Date;
  veiculo: { placa: string; modelo: string };
};

export type SolicitacaoUrgenteSincronizacao = {
  id: string;
  protocolo: string;
  setorOrigem: string | null;
  destino: string | null;
};

export type SnapshotSincronizacaoFrota = {
  dia: string;
  timestampMs: number;
  motoristas: MotoristaSincronizacao[];
  documentosAtuaisVeiculos: DocumentoAtualSincronizacao[];
  solicitacoesUrgentes: SolicitacaoUrgenteSincronizacao[];
};

const ultimaSincronizacaoPorUsuario = new Map<string, RegistroSincronizacaoUsuario>();
let snapshotSincronizacaoFrota: SnapshotSincronizacaoFrota | null = null;

export function obterUltimaSincronizacaoNotificacoes(
  usuarioId: string,
): RegistroSincronizacaoUsuario | undefined {
  return ultimaSincronizacaoPorUsuario.get(usuarioId);
}

export function registrarSincronizacaoNotificacoes(
  usuarioId: string,
  registro: RegistroSincronizacaoUsuario,
): void {
  ultimaSincronizacaoPorUsuario.set(usuarioId, registro);
}

export function obterSnapshotSincronizacaoFrota(): SnapshotSincronizacaoFrota | null {
  return snapshotSincronizacaoFrota;
}

export function registrarSnapshotSincronizacaoFrota(snapshot: SnapshotSincronizacaoFrota): void {
  snapshotSincronizacaoFrota = snapshot;
}

export function invalidarCacheSincronizacaoNotificacoes(usuarioId?: string): void {
  snapshotSincronizacaoFrota = null;
  if (usuarioId) {
    ultimaSincronizacaoPorUsuario.delete(usuarioId);
    return;
  }
  ultimaSincronizacaoPorUsuario.clear();
}
