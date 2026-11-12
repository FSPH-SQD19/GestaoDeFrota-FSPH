import React, { lazy, Suspense, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/auth";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { podeAcessar, telaInicial, type TabId } from "./config/navigation";

const SvoPage = lazy(() =>
  import("./pages/svo/SvoPage").then((module) => ({ default: module.SvoPage })),
);

const DashboardPage = lazy(() =>
  import("./pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const VeiculosPage = lazy(() =>
  import("./pages/veiculos/VeiculosPage").then((module) => ({ default: module.VeiculosPage })),
);
const AvariasPage = lazy(() =>
  import("./pages/avarias/AvariasPage").then((module) => ({ default: module.AvariasPage })),
);
const AgendaPage = lazy(() =>
  import("./pages/solicitacoes/AgendaPage").then((module) => ({ default: module.AgendaPage })),
);
const SolicitacoesPage = lazy(() =>
  import("./pages/solicitacoes/SolicitacoesPage").then((module) => ({
    default: module.SolicitacoesPage,
  })),
);
const MinhasViagensPage = lazy(() =>
  import("./pages/viagens/MinhasViagensPage").then((module) => ({
    default: module.MinhasViagensPage,
  })),
);
const MinhasColetasSvoPage = lazy(() =>
  import("./pages/svo/MinhasColetasSvoPage").then((module) => ({
    default: module.MinhasColetasSvoPage,
  })),
);
const MotoristasPage = lazy(() =>
  import("./pages/motorista/MotoristaPage").then((module) => ({ default: module.MotoristasPage })),
);

const RelatoriosPage = lazy(() =>
  import("./pages/relatorios/RelatoriosPage").then((module) => ({
    default: module.RelatoriosPage,
  })),
);

const UsuariosPage = lazy(() =>
  import("./pages/usuarios/UsuariosPage").then((module) => ({ default: module.UsuariosPage })),
);

const AuditoriaPage = lazy(() =>
  import("./pages/auditoria/AuditoriaPage").then((module) => ({ default: module.AuditoriaPage })),
);

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const roles = user?.roles ?? [];
  const [authView, setAuthView] = useState<"login" | "forgot">("login");
  const [activeTab, setActiveTab] = useState<TabId>(() => telaInicial(roles));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F6F7F9] font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
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

  // Shell Autenticado (Sidebar + Header + Conteúdo)
  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      <Sidebar
        activeTab={currentTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Central de Conteúdo Responsiva */}
      <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-5 max-w-[1440px] w-full mx-auto">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
        <main className="mt-2 flex-1">
          <Suspense
            fallback={
              <div
                role="status"
                className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
              >
                Carregando módulo...
              </div>
            }
          >
            {currentTab === "dashboard" && <DashboardPage />}
            {currentTab === "veiculos" && <VeiculosPage />}
            {currentTab === "avarias" && <AvariasPage />}

            {currentTab === "viagens" && <MinhasViagensPage />}
            {currentTab === "coletasSvo" && <MinhasColetasSvoPage />}

            {currentTab === "motoristas" && <MotoristasPage />}

            {currentTab === "solicitacoes" && <SolicitacoesPage />}
            {currentTab === "agenda" && <AgendaPage />}

            {currentTab === "svo" && <SvoPage />}

            {currentTab === "relatorios" && <RelatoriosPage />}
            {currentTab === "usuarios" && <UsuariosPage />}
            {currentTab === "auditoria" && <AuditoriaPage />}
          </Suspense>
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
