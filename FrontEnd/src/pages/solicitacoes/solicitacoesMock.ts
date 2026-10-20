import type { SolicitacaoViagem } from '../../types/solicitacao'

// Dados sintéticos para o protótipo — substituir pela API quando o endpoint existir.
function daysFromNow(days: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function criarSolicitacoesMock(solicitanteNome: string): SolicitacaoViagem[] {
  return [
    {
      id: 'sol-1',
      protocolo: 'SV-2026-0142',
      solicitanteNome,
      setorOrigem: 'LACEN',
      origem: 'LACEN — Rua Campo do Brito, Aracaju',
      destino: 'Hospital Regional de Itabaiana',
      dataHoraPretendida: daysFromNow(2, 8, 30),
      dataHoraRetornoPrevista: daysFromNow(2, 14),
      quantidadePassageiros: 1,
      tipoTransporte: 'MATERIAL_BIOLOGICO',
      urgencia: 'URGENTE',
      justificativa: 'Coleta de amostras para análise de surto de dengue.',
      status: 'PENDENTE',
      criadoEm: daysFromNow(0, 9, 12),
    },
    {
      id: 'sol-2',
      protocolo: 'SV-2026-0137',
      solicitanteNome,
      setorOrigem: 'LACEN',
      origem: 'LACEN — Rua Campo do Brito, Aracaju',
      destino: 'Secretaria de Estado da Saúde (SES)',
      dataHoraPretendida: daysFromNow(1, 10),
      dataHoraRetornoPrevista: daysFromNow(1, 12),
      quantidadePassageiros: 3,
      tipoTransporte: 'PASSAGEIROS',
      urgencia: 'NORMAL',
      justificativa: 'Reunião técnica sobre indicadores laboratoriais.',
      status: 'APROVADA',
      criadoEm: daysFromNow(-2, 15, 40),
      veiculoAlocado: { placa: 'BRA-2E19', modelo: 'Chevrolet Spin 1.8 LTZ' },
      motoristaAlocado: { nome: 'Carlos Alberto' },
    },
    {
      id: 'sol-3',
      protocolo: 'SV-2026-0129',
      solicitanteNome,
      setorOrigem: 'LACEN',
      origem: 'LACEN — Rua Campo do Brito, Aracaju',
      destino: 'Hemose — Av. Tancredo Neves',
      dataHoraPretendida: daysFromNow(0, 7, 30),
      quantidadePassageiros: 0,
      tipoTransporte: 'DOCUMENTOS_INSUMOS',
      urgencia: 'NORMAL',
      justificativa: 'Entrega de reagentes e kits de testagem.',
      status: 'EM_TRANSITO',
      criadoEm: daysFromNow(-3, 11),
      veiculoAlocado: { placa: 'IAF-4820', modelo: 'Renault Master L3H2 Furgão' },
      motoristaAlocado: { nome: 'José Ribeiro' },
    },
    {
      id: 'sol-4',
      protocolo: 'SV-2026-0110',
      solicitanteNome,
      setorOrigem: 'LACEN',
      origem: 'LACEN — Rua Campo do Brito, Aracaju',
      destino: 'Hospital Regional de Lagarto',
      dataHoraPretendida: daysFromNow(-6, 8),
      dataHoraRetornoPrevista: daysFromNow(-6, 17),
      quantidadePassageiros: 2,
      tipoTransporte: 'MISTO',
      urgencia: 'NORMAL',
      justificativa: 'Capacitação de equipe e transporte de equipamentos.',
      status: 'CONCLUIDA',
      criadoEm: daysFromNow(-10, 14),
      veiculoAlocado: { placa: 'QNE-1934', modelo: 'Toyota Hilux 4x4' },
      motoristaAlocado: { nome: 'Carlos Alberto' },
    },
    {
      id: 'sol-5',
      protocolo: 'SV-2026-0098',
      solicitanteNome,
      setorOrigem: 'LACEN',
      origem: 'LACEN — Rua Campo do Brito, Aracaju',
      destino: 'Estância — Unidade Básica de Saúde',
      dataHoraPretendida: daysFromNow(-4, 9),
      quantidadePassageiros: 4,
      tipoTransporte: 'PASSAGEIROS',
      urgencia: 'NORMAL',
      justificativa: 'Visita técnica de supervisão.',
      status: 'RECUSADA',
      criadoEm: daysFromNow(-8, 10),
      motivoRecusa: 'Sem veículo disponível na data. Favor reagendar para a semana seguinte.',
    },
  ]
}
