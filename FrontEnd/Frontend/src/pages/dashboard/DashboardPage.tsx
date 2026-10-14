import React, { useState } from 'react'
import {
  Car,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Card, Badge, Button } from '../../components/common'

type ViagemFilter = 'TODAS' | 'TRANSITO' | 'PENDENTE' | 'DESINFECCAO'

export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const [viagemFilter, setViagemFilter] = useState<ViagemFilter>('TODAS')
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null)

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const formattedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)

  // Dados do gráfico semanal com segmentação analítica (dashboard-designer Level 2)
  const weeklyData = [
    { day: 'Seg', adm: 8, svo: 4, total: 12, height: '60%' },
    { day: 'Ter', adm: 11, svo: 7, total: 18, height: '95%', isPeak: true },
    { day: 'Qua', adm: 9, svo: 6, total: 15, height: '80%' },
    { day: 'Qui', adm: 5, svo: 3, total: 8, height: '42%' },
    { day: 'Sex', adm: 9, svo: 5, total: 14, height: '74%' },
    { day: 'Sáb', adm: 2, svo: 4, total: 6, height: '32%' },
    { day: 'Dom', adm: 1, svo: 3, total: 4, height: '22%' },
  ]

  // Lista de solicitações e viagens operacionais (Level 3 Operational Data)
  const solicitacoes = [
    {
      id: 'TR-2026-087',
      categoria: 'Administrativa / LACEN',
      titulo: 'Remessa de Amostras Biológicas',
      origemDestino: 'LACEN → Hemocentro (Hemose)',
      veiculo: 'Renault Master (IAF-4820)',
      motorista: 'Carlos Alberto Santos',
      horario: '14:30',
      status: 'Pendente' as const,
      statusKey: 'PENDENTE',
      esperaMinutos: '14 min',
    },
    {
      id: 'SVO-2026-042',
      categoria: 'SVO Especializada',
      titulo: 'Ordem de Verificação Domiciliar',
      origemDestino: 'Base SVO → Atalaia (Zona Sul)',
      veiculo: 'Chevrolet S10 4x4 (QMA-9124)',
      motorista: 'Marcos Vinícius Silva',
      horario: '13:15',
      status: 'Em trânsito' as const,
      statusKey: 'TRANSITO',
      previsaoRetorno: '15:10',
    },
    {
      id: 'TR-2026-086',
      categoria: 'Administrativa / SES',
      titulo: 'Deslocamento Técnico de Diretoria',
      origemDestino: 'FSPH Sede → Secretaria de Estado da Saúde',
      veiculo: 'Chevrolet Spin (BRA-2E19)',
      motorista: 'João Paulo Lima',
      horario: '11:00',
      status: 'Aprovada' as const,
      statusKey: 'TRANSITO',
      previsaoRetorno: '16:00',
    },
    {
      id: 'SVO-2026-041',
      categoria: 'SVO Especializada',
      titulo: 'Protocolo de Desinfecção Terminal',
      origemDestino: 'Pátio de Assepsia · Box 02',
      veiculo: 'Chevrolet S10 Especializada (QKN-5582)',
      motorista: 'Equipe de Higienização SVO',
      horario: '09:40',
      status: 'Desinfecção' as const,
      statusKey: 'DESINFECCAO',
      previsaoTermino: '15:30',
    },
  ]

  const filteredSolicitacoes = solicitacoes.filter((item) => {
    if (viagemFilter === 'TODAS') return true
    if (viagemFilter === 'TRANSITO') return item.statusKey === 'TRANSITO'
    if (viagemFilter === 'PENDENTE') return item.statusKey === 'PENDENTE'
    if (viagemFilter === 'DESINFECCAO') return item.statusKey === 'DESINFECCAO'
    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho com Data e Boas-Vindas */}
      <div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
          {formattedDate}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
          Olá, {user?.nome || 'Gestor'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Painel Geral de Operações · Frota Integrada &amp; SVO
        </p>
      </div>

      {/* Nível 1: 4 KPIs Principais com Contexto Acionável (Dashboard Designer Rule) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5">
        {/* KPI 1: Prontidão da Frota */}
        <div className="relative bg-white rounded-3xl p-5.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Viaturas Prontas
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Disponíveis na base
              </p>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/90 shadow-2xs">
              <Car className="w-4.5 h-4.5 stroke-[2]" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                2
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 7 viaturas</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Master e Ducato no pátio</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Viagens em Curso */}
        <div className="relative bg-white rounded-3xl p-5.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Em Deslocamento
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Viagens em trânsito
              </p>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/90 shadow-2xs">
              <TrendingUp className="w-4.5 h-4.5 stroke-[2]" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                5
              </span>
              <span className="text-sm font-semibold text-slate-400">em rota (71%)</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-700 font-medium">
              <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>3 Administrativas · 2 SVO</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Solicitações Aguardando Despacho */}
        <div className="relative bg-white rounded-3xl p-5.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fila de Espera
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Aguardando despacho
              </p>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/90 shadow-2xs">
              <AlertTriangle className="w-4.5 h-4.5 stroke-[2]" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                1
              </span>
              <span className="text-sm font-semibold text-amber-600">ação imediata</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 font-medium truncate">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">TR-087 LACEN há 14 min</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Biossegurança SVO */}
        <div className="relative bg-white rounded-3xl p-5.5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Biossegurança SVO
              </span>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Quarentena / Assepsia
              </p>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/90 shadow-2xs">
              <ShieldAlert className="w-4.5 h-4.5 stroke-[2]" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                1
              </span>
              <span className="text-sm font-semibold text-slate-400">em desinfecção</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700 font-medium truncate">
              <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">S10 QKN-5582 liberação às 15:30</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nível 2: Gráficos Primários e Contexto Analítico (Dashboard Designer Level 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Gráfico Primário: Volume Semanal de Viagens com Insight no Título */}
        <Card className="lg:col-span-7 rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Volume de Viagens na Semana
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-blue-600">Pico Operacional: Terça-feira (18 viagens)</span> · LACEN e SVO
                </p>
              </div>

              {/* Legenda de Categorias Semânticas */}
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                  <span>Administrativa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                  <span>SVO Especializada</span>
                </div>
              </div>
            </div>

            {/* Barras do Gráfico com Segmentação Visual */}
            <div className="mt-8">
              <div className="h-48 w-full flex items-end justify-between gap-3 px-2">
                {weeklyData.map((item, index) => {
                  const isHovered = hoveredBarIndex === index
                  const total = item.adm + item.svo
                  const admPercent = Math.round((item.adm / total) * 100)
                  const svoPercent = 100 - admPercent

                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-2 group h-full justify-end cursor-pointer"
                      onMouseEnter={() => setHoveredBarIndex(index)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                    >
                      {/* Tooltip Detalhado com Dados Analíticos */}
                      <div
                        className={`transition-all duration-150 bg-slate-900 text-white text-[11px] font-medium py-1.5 px-2.5 rounded-xl shadow-lg -mb-1 pointer-events-none z-10 flex flex-col items-center whitespace-nowrap ${
                          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                      >
                        <span className="font-bold text-white">{item.total} viagens</span>
                        <span className="text-[10px] text-slate-300">
                          {item.adm} Adm ({admPercent}%) · {item.svo} SVO ({svoPercent}%)
                        </span>
                      </div>

                      {/* Coluna da Barra Segmentada */}
                      <div className="w-full max-w-[42px] bg-slate-100 rounded-xl overflow-hidden h-full flex flex-col justify-end p-0.5 border border-slate-200/60 transition-colors group-hover:border-slate-300">
                        {/* Segmento SVO (Índigo) */}
                        <div
                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all duration-300"
                          style={{ height: `${(item.svo / 20) * 100}%` }}
                        />
                        {/* Segmento Administrativo (Azul Cobalto) */}
                        <div
                          className="w-full bg-gradient-to-t from-blue-700 to-blue-500 rounded-b-md transition-all duration-300 mt-0.5"
                          style={{ height: `${(item.adm / 20) * 100}%` }}
                        />
                      </div>

                      {/* Rótulo do Dia da Semana */}
                      <span
                        className={`text-xs font-bold transition-colors ${
                          item.isPeak ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-900'
                        }`}
                      >
                        {item.day}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total consolidado: <strong>77 viagens</strong> nos últimos 7 dias</span>
            <span className="font-medium text-blue-600">Meta semanal: 80% atendidas no prazo</span>
          </div>
        </Card>

        {/* Nível 2 Secundário: Prontidão por Frota (Capacidade e Alocação) */}
        <Card className="lg:col-span-5 rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Alocação e Capacidade por Frota
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Segregação sanitária e operacional das 7 viaturas
              </p>
            </div>

            <div className="space-y-6 mt-6">
              {/* Frota Administrativa / Assistencial */}
              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <div className="flex items-center gap-2 text-slate-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span>Frota Geral &amp; Assistencial</span>
                  </div>
                  <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/50">
                    4 Viaturas
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-600" style={{ width: '50%' }} title="2 em trânsito" />
                  <div className="h-full bg-emerald-500" style={{ width: '50%' }} title="2 disponíveis" />
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> 2 em trânsito
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 2 disponíveis
                  </span>
                </div>
              </div>

              {/* Frota Especializada SVO */}
              <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <div className="flex items-center gap-2 text-slate-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span>Frota Especializada SVO</span>
                  </div>
                  <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/50">
                    3 Viaturas
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-600" style={{ width: '67%' }} title="2 em atendimento externo" />
                  <div className="h-full bg-rose-500" style={{ width: '33%' }} title="1 em desinfecção" />
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> 2 em atendimento
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 1 em assepsia
                  </span>
                </div>
              </div>

              {/* Dica de Protocolo Sanitário */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-amber-900 text-xs">
                <p className="font-semibold">Protocolo de Biossegurança Ativo</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Viaturas SVO passam obrigatoriamente por 45 min de desinfecção antes do retorno à disponibilidade.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Pátio Operacional Central · FSPH</span>
            <span className="text-slate-600 font-semibold">100% frota rastreada</span>
          </div>
        </Card>
      </div>

      {/* Nível 3: Tabela Operacional de Viagens & Despachos (Dashboard Designer Level 3) */}
      <Card className="rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Painel de Viagens &amp; Despachos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de deslocamentos em tempo real e aprovações pendentes
            </p>
          </div>

          {/* Filtros Rápidos (Abas Operacionais) */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViagemFilter('TODAS')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                viagemFilter === 'TODAS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas (4)
            </button>
            <button
              type="button"
              onClick={() => setViagemFilter('TRANSITO')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                viagemFilter === 'TRANSITO'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Em Trânsito (2)
            </button>
            <button
              type="button"
              onClick={() => setViagemFilter('PENDENTE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                viagemFilter === 'PENDENTE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes (1)
            </button>
            <button
              type="button"
              onClick={() => setViagemFilter('DESINFECCAO')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                viagemFilter === 'DESINFECCAO'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Assepsia (1)
            </button>
          </div>
        </div>

        {/* Linhas de Viagens */}
        <div className="divide-y divide-slate-100 mt-1">
          {filteredSolicitacoes.map((item) => (
            <div
              key={item.id}
              className="py-4 px-2 rounded-2xl hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
                    {item.id}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">·</span>
                  <span className="text-xs font-semibold text-blue-600">
                    {item.categoria}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {item.horario}
                  </span>
                </div>

                <p className="text-sm font-bold text-slate-900">
                  {item.titulo}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span><strong>Trajeto:</strong> {item.origemDestino}</span>
                  <span><strong>Viatura:</strong> {item.veiculo}</span>
                  <span><strong>Condutor:</strong> {item.motorista}</span>
                </div>
              </div>

              {/* Status e Ação Operacional Direta */}
              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                {item.status === 'Pendente' && (
                  <Badge variant="warning">Aguardando Despacho</Badge>
                )}
                {item.status === 'Em trânsito' && (
                  <Badge variant="info">Em Trânsito</Badge>
                )}
                {item.status === 'Aprovada' && (
                  <Badge variant="success">Em Rota (Aprovada)</Badge>
                )}
                {item.status === 'Desinfecção' && (
                  <Badge variant="danger">Desinfecção Terminal</Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1 font-semibold"
                  onClick={() => alert(`Acessando detalhes da viagem ${item.id}`)}
                >
                  <span>Detalhes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
