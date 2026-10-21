import React, { useState } from "react";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { NAV_SECTIONS, itensVisiveis, telaInicial, type TabId } from "../../config/navigation";
import { cn } from "../../lib/utils";
import rotaSymbol from "../../assets/branding/rota/rota-symbol-color.svg";

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const roles = user?.roles ?? [];

  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : "V";
  const activeRoleName = user?.roles?.[0] || "GESTOR";

  const roleDisplayMap: Record<string, string> = {
    ADMIN: "Administrador",
    GESTOR: "Gestor de Frota",
    MOTORISTA: "Motorista Oficial",
    ATENDENTE_SVO: "Atendente SVO",
    SOLICITANTE: "Solicitante Setorial",
  };

  return (
    <>
      {/* Backdrop para telas mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Flutuante Dark Executiva */}
      <aside
        className={cn(
          "fixed lg:sticky top-4 left-4 z-50 h-[calc(100vh-2rem)] bg-[#090D16] text-white rounded-3xl flex flex-col justify-between shadow-2xl border border-slate-800/80 shrink-0 select-none transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20 p-3" : "w-72 p-5",
          isMobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0",
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header da Sidebar: Logo ROTA + Botão de Colapso (Rail Mode) */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div
              className={cn(
                "flex items-center gap-3 min-w-0",
                isCollapsed && "justify-center w-full",
              )}
            >
              {/* Emblema ROTA em Contêiner Branco de Alto Contraste */}
              <div
                className="w-11 h-11 rounded-2xl bg-white shadow-md shadow-blue-500/10 p-2 flex items-center justify-center shrink-0 border border-white/90 group cursor-pointer"
                onClick={() => onSelectTab(telaInicial(roles))}
                title="ROTA · Frota FSPH"
              >
                <img
                  src={rotaSymbol}
                  alt="Símbolo Rota"
                  className="w-full h-full object-contain transition-transform group-hover:scale-105"
                />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-lg text-white tracking-tight leading-tight">
                      ROTA
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[9px] font-bold tracking-wider">
                      FSPH
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium leading-tight truncate">
                    Gestão de Frota e SVO
                  </span>
                </div>
              )}
            </div>

            {/* Botão de Toggle Expandir / Recolher (Oculto no Mobile) */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Recolher barra lateral"
                aria-label="Recolher barra lateral"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Botão Expandir quando colapsado */}
          {isCollapsed && (
            <div className="hidden lg:flex justify-center pb-2">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Expandir barra lateral"
                aria-label="Expandir barra lateral"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="border-t border-slate-800/80 my-2" />

          {/* Navegação Estruturada por Seções */}
          <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-0.5 custom-scrollbar">
            {NAV_SECTIONS.map((section, sIndex) => {
              const visibleSectionItems = itensVisiveis(section, roles);
              if (visibleSectionItems.length === 0) return null;

              return (
                <div key={sIndex} className="space-y-1">
                  {!isCollapsed && section.title && (
                    <span className="block px-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
                      {section.title}
                    </span>
                  )}

                  {visibleSectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const label = item.label(roles);
                    const badge = item.badge?.(roles);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        title={isCollapsed ? label : undefined}
                        className={cn(
                          "w-full flex items-center rounded-2xl text-sm font-semibold transition-all duration-150 relative cursor-pointer",
                          isCollapsed ? "justify-center p-3" : "justify-between px-3.5 py-2.5",
                          isActive
                            ? "bg-white text-slate-950 shadow-md shadow-white/10 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/5",
                        )}
                      >
                        {/* Linha indicadora de item ativo (Senior UI Precision) */}
                        {isActive && !isCollapsed && (
                          <span className="absolute left-1.5 top-2.5 bottom-2.5 w-1 bg-blue-600 rounded-full" />
                        )}

                        <div className="flex items-center gap-3">
                          <Icon
                            className={cn(
                              "w-4.5 h-4.5 shrink-0",
                              isActive
                                ? "text-slate-950 stroke-[2.2]"
                                : "text-slate-400 stroke-[1.8]",
                            )}
                          />
                          {!isCollapsed && <span>{label}</span>}
                        </div>

                        {/* Badge de Contagem / Notificação */}
                        {badge && (
                          <>
                            {!isCollapsed ? (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[11px] font-bold",
                                  isActive
                                    ? "bg-slate-900 text-white"
                                    : "bg-rose-500 text-white shadow-xs",
                                )}
                              >
                                {badge}
                              </span>
                            ) : (
                              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#090D16]" />
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bloco Inferior: Perfil do Usuário com Logout */}
        <div className="pt-3 border-t border-slate-800/80">
          {/* Cartão de Perfil do Usuário com Indicador de Presença Online */}
          <div
            className={cn(
              "flex items-center rounded-2xl bg-white/5 border border-white/5 transition-all",
              isCollapsed ? "justify-center p-2" : "justify-between p-2.5",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/10 shrink-0">
                  {userInitial}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#090D16]" />
              </div>

              {!isCollapsed && (
                <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
                  <span className="text-xs font-bold text-white leading-tight truncate">
                    {user?.nome || "Vitor Santos"}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight truncate">
                    {roleDisplayMap[activeRoleName] || activeRoleName}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              className={cn(
                "rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer",
                isCollapsed ? "mt-1 p-1" : "p-1.5",
              )}
              title="Encerrar sessão"
              aria-label="Encerrar sessão"
            >
              <LogOut className="w-4 h-4 stroke-[1.8]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
