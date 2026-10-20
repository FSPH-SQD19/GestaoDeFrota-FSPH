import React, { useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/auth'
import { LoginPage } from './pages/auth/LoginPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { VeiculosPage } from './pages/veiculos/VeiculosPage'
import { SolicitacoesPage } from './pages/solicitacoes/SolicitacoesPage'
import { Card, Badge } from './components/common'
import { FileText, Users, PhoneCall, BarChart3, ShieldCheck } from 'lucide-react'

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, hasRole } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'forgot'>('login')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Carregando sistema FSPH...</span>
        </div>
      </div>
    )
  }

  // Visualização de telas não autenticadas (Login / Esqueci a Senha)
  if (!isAuthenticated) {
    if (authView === 'forgot') {
      return <ForgotPasswordPage onBackToLogin={() => setAuthView('login')} />
    }
    return <LoginPage onNavigateToForgot={() => setAuthView('forgot')} />
  }

  // Shell Autenticado (Sidebar Flutuante + Header + Conteúdo)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Sidebar Flutuante Dark em Cápsula (Figma) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Central de Conteúdo Responsiva */}
      <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-10 py-4 lg:py-6 max-w-[1500px] w-full">
        {/* Header Superior com Notificações e Pílula do Usuário */}
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
        <main className="mt-4 flex-1">
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'veiculos' && <VeiculosPage />}

          {/* Placeholders informativos para as abas restantes */}
          {activeTab === 'motoristas' && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Gestão de Motoristas</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Cadastro de condutores, controle de validade de CNH com alertas de bloqueio e escalas operacionais.
              </p>
              <Badge variant="info">Módulo em desenvolvimento</Badge>
            </Card>
          )}

          {activeTab === 'solicitacoes' && hasRole(['SOLICITANTE']) && <SolicitacoesPage />}

          {activeTab === 'solicitacoes' && !hasRole(['SOLICITANTE']) && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Solicitações de Viagem</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Aprovação e recusa de viagens da frota administrativa pelos setores da FSPH (LACEN, Hemose, etc.).
              </p>
              <Badge variant="warning">1 solicitação aguardando aprovação</Badge>
            </Card>
          )}

          {activeTab === 'svo' && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Módulo Especializado SVO</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Triagem médica por telefone, emissão de ordens de coleta de óbitos, controle do limite de capacidade (S10) e desinfecção obrigatória.
              </p>
              <Badge variant="danger">Restrito: Atendente SVO & Administrador</Badge>
            </Card>
          )}

          {activeTab === 'relatorios' && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Relatórios & Indicadores</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Relatórios de consumo médio de combustível (km/L), manutenções e auditoria do sistema para prestação de contas.
              </p>
              <Badge variant="neutral">Exportação em PDF e Excel</Badge>
            </Card>
          )}

          {activeTab === 'usuarios' && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Controle de Usuários e RBAC</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Gestão de permissões por perfil (Administrador, Gestor de Frota, Motorista, Atendente SVO, Solicitante).
              </p>
              <Badge variant="neutral">Exclusivo para perfil Administrador</Badge>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
