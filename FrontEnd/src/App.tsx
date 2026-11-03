import React, { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/auth";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { podeAcessar, telaInicial, type TabId } from "./config/navigation";
import { api } from "./services/api";

const MotoristaPwa = lazy(() => import("./features/motorista/MotoristaPwa"));
const CentralOperacional = lazy(() => import("./features/motorista/CentralOperacional"));

const SvoPage = lazy(() =>
  import("./pages/svo/SvoPage").then((module) => ({ default: module.SvoPage })),
);

const DashboardPage = lazy(() =>
  import("./pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const VeiculosPage = lazy(() =>
  import("./pages/veiculos/VeiculosPage").then((module) => ({ default: module.VeiculosPage })),
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

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const roles = user?.roles ?? [];
  const [authView, setAuthView] = useState<"login" | "forgot">("login");
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    window.location.pathname === "/motorista" && roles.includes("MOTORISTA")
      ? "viagens"
      : telaInicial(roles),
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pwaConfig, setPwaConfig] = useState<{ motoristaId: string; enabled: boolean } | null>(
    null,
  );
  const motoristaId = isAuthenticated && roles.includes("MOTORISTA") ? user?.id : undefined;
  const pwaHabilitado = pwaConfig?.motoristaId === motoristaId ? pwaConfig?.enabled : null;

  useEffect(() => {
    if (!motoristaId) return;
    let active = true;
    void api
      .get<{ enabled: boolean }>("/api/v1/motorista/config")
      .then(({ data }) => {
        if (active) setPwaConfig({ motoristaId, enabled: data.enabled !== false });
      })
      .catch(() => {
        // O PWA restaura a saída local e apresenta a falha de conexão ou sessão.
        if (active) setPwaConfig({ motoristaId, enabled: true });
      });
    return () => {
      active = false;
    };
  }, [motoristaId]);

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
  const currentTab: TabId =
    window.location.pathname === "/motorista" && roles.includes("MOTORISTA")
      ? "viagens"
      : podeAcessar(activeTab, roles)
        ? activeTab
        : telaInicial(roles);

  if (currentTab === "viagens" && pwaHabilitado !== false)
    return (
      <Suspense
        fallback={
          <div role="status" className="grid min-h-dvh place-items-center bg-slate-100">
            Carregando suas viagens...
          </div>
        }
      >
        {pwaHabilitado === null ? (
          <div role="status" className="grid min-h-dvh place-items-center bg-slate-100">
            Carregando suas viagens...
          </div>
        ) : (
          <MotoristaPwa
            onOpenManagement={
              roles.some((role) => ["ADMIN", "GESTOR", "SVO", "SOLICITANTE"].includes(role))
                ? () => {
                    window.history.replaceState(null, "", "/");
                    setActiveTab(telaInicial(roles));
                  }
                : undefined
            }
          />
        )}
      </Suspense>
    );

  // Shell Autenticado (Sidebar Flutuante + Header + Conteúdo)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* Sidebar Flutuante Dark em Cápsula (Figma) */}
      <Sidebar
        activeTab={currentTab}
        onSelectTab={(tab) => {
          if (window.location.pathname === "/motorista" && tab !== "viagens")
            window.history.replaceState(null, "", "/");
          setActiveTab(tab);
        }}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Central de Conteúdo Responsiva */}
      <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-10 py-4 lg:py-6 max-w-[1500px] w-full mx-auto">
        {/* Header Superior com Notificações e Pílula do Usuário */}
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
        <main className="mt-4 flex-1">
          <Suspense
            fallback={
              <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6">
                Carregando módulo...
              </div>
            }
          >
            {currentTab === "dashboard" && <DashboardPage />}
            {currentTab === "veiculos" && <VeiculosPage />}

            {currentTab === "rastreamento" && <CentralOperacional />}
            {currentTab === "viagens" && <MinhasViagensPage />}

            {currentTab === "motoristas" && <MotoristasPage />}

            {currentTab === "solicitacoes" && <SolicitacoesPage />}

            {currentTab === "svo" && <SvoPage />}

            {currentTab === "relatorios" && <RelatoriosPage />}
            {currentTab === "usuarios" && <UsuariosPage />}
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
