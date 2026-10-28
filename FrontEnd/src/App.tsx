import React, { useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/auth";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { VeiculosPage } from "./pages/veiculos/VeiculosPage";
import { SolicitacoesPage } from "./pages/solicitacoes/SolicitacoesPage";
import { MotoristasPage } from "./pages/motorista/MotoristaPage";
import { podeAcessar, telaInicial, type TabId } from "./config/navigation";
import { Card, Badge } from "./components/common";
import { PhoneCall, BarChart3, ShieldCheck, Route } from "lucide-react";

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const roles = user?.roles ?? [];
  const [authView, setAuthView] = useState<"login" | "forgot">("login");
  const [activeTab, setActiveTab] = useState<TabId>(() => telaInicial(roles));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Carregando sistema FSPH...</span>
        </div>
      </div>
    );
  }

  // Visualização de telas não autenticadas (Login / Esqueci a Senha)
  if (!isAuthenticated) {
    if (authView === "forgot") {
      return <ForgotPasswordPage onBackToLogin={() => setAuthView("login")} />;
    }
    return <LoginPage onNavigateToForgot={() => setAuthView("forgot")} />;
  }

  // Se o perfil atual não tiver acesso à aba selecionada, cai na tela inicial do perfil
  const currentTab: TabId = podeAcessar(activeTab, roles) ? activeTab : telaInicial(roles);

  // Shell Autenticado (Sidebar Flutuante + Header + Conteúdo)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Sidebar Flutuante Dark em Cápsula (Figma) */}
      <Sidebar
        activeTab={currentTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Central de Conteúdo Responsiva */}
      <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-10 py-4 lg:py-6 max-w-[1500px] w-full mx-auto">
        {/* Header Superior com Notificações e Pílula do Usuário */}
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
        <main className="mt-4 flex-1">
          {currentTab === "dashboard" && <DashboardPage />}
          {currentTab === "veiculos" && <VeiculosPage />}

          {currentTab === "viagens" && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Route className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Minhas Viagens</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Viagens escaladas para você, checklist de saída e retorno, registro de odômetro e
                abastecimento (visão mobile / PWA).
              </p>
              <Badge variant="info">Módulo mobile / PWA em desenvolvimento</Badge>
            </Card>
          )}

          {currentTab === "motoristas" && <MotoristasPage />}

          {currentTab === "solicitacoes" && <SolicitacoesPage />}

          {currentTab === "svo" && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Módulo Especializado SVO</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Triagem médica por telefone, emissão de ordens de coleta de óbitos, controle do
                limite de capacidade (S10) e desinfecção obrigatória.
              </p>
              <Badge variant="danger">Restrito: Atendente SVO & Administrador</Badge>
            </Card>
          )}

          {currentTab === "relatorios" && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Relatórios & Indicadores</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Relatórios de consumo médio de combustível (km/L), manutenções e auditoria do
                sistema para prestação de contas.
              </p>
              <Badge variant="neutral">Exportação em PDF e Excel</Badge>
            </Card>
          )}

          {currentTab === "usuarios" && (
            <Card className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Controle de Usuários e RBAC</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Gestão de permissões por perfil (Administrador, Gestor de Frota, Motorista,
                Atendente SVO, Solicitante).
              </p>
              <Badge variant="neutral">Exclusivo para perfil Administrador</Badge>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
