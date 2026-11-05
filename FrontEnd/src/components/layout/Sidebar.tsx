import React, { useState } from "react";
import { LogOut, Pin, PinOff } from "lucide-react";
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const roles = user?.roles ?? [];

  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : "?";
  const activeRoleName = user?.roles?.[0];

  const roleDisplayMap: Record<string, string> = {
    ADMIN: "Administrador",
    GESTOR: "Gestor de Frota",
    MOTORISTA: "Motorista Oficial",
    SVO: "Atendente SVO",
    SOLICITANTE: "Solicitante Setorial",
  };

  // No mobile: expande se o drawer estiver aberto.
  // No desktop: colapsado por padrão (rail mode), expande suavemente por hover ou se fixado (pin).
  const isExpanded = isMobileOpen || isPinned || isHovered;

  const handleMouseEnter = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsHovered(false);
    }
  };

  return (
    <>
      {/* Backdrop escuro para telas mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Flutuante Dark Executiva */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed lg:sticky top-4 left-4 z-50 h-[calc(100vh-2rem)] bg-[#090D16] text-white rounded-3xl flex flex-col justify-between shadow-2xl border border-slate-800/80 shrink-0 select-none overflow-hidden transition-[width,padding] duration-300 ease-in-out",
          // Larguras: w-72 expandido, w-20 colapsado
          isExpanded ? "w-72 p-5" : "w-20 p-3.5",
          isMobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0",
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header da Sidebar: Logo ROTA + Botão de Fixar */}
          <div className="flex items-center justify-between mb-3 h-11 shrink-0">
            <div
              className={cn(
                "flex items-center min-w-0 transition-all duration-300 ease-in-out",
                isExpanded ? "w-auto" : "w-full justify-center",
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

              {/* Título ROTA FSPH com expansão e fade perfeitamente contínuos */}
              <div
                className={cn(
                  "flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
                  isExpanded
                    ? "max-w-[180px] opacity-100 ml-3"
                    : "max-w-0 opacity-0 ml-0 pointer-events-none",
                )}
              >
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
            </div>

            {/* Botão de Fixar / Desafixar no Desktop */}
            <button
              type="button"
              onClick={() => setIsPinned((prev) => !prev)}
              className={cn(
                "hidden lg:flex p-1.5 rounded-xl transition-all duration-300 cursor-pointer shrink-0",
                isExpanded
                  ? "opacity-100 scale-100 ml-2"
                  : "opacity-0 scale-75 pointer-events-none w-0 p-0 ml-0 overflow-hidden",
                isPinned
                  ? "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-white/10",
              )}
              title={isPinned ? "Desafixar menu (recolher ao tirar o mouse)" : "Fixar menu aberto"}
              aria-label={isPinned ? "Desafixar menu" : "Fixar menu"}
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
          </div>

          <div className="border-t border-slate-800/80 my-2 shrink-0" />

          {/* Navegação Estruturada por Seções */}
          <nav className="flex-1 min-h-0 space-y-3 overflow-y-auto custom-scrollbar">
            {NAV_SECTIONS.map((section, sIndex) => {
              const visibleSectionItems = itensVisiveis(section, roles);
              if (visibleSectionItems.length === 0) return null;

              return (
                <div key={sIndex} className="space-y-1">
                  {section.title && (
                    <span
                      className={cn(
                        "block px-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
                        isExpanded
                          ? "max-h-5 opacity-100 mb-1"
                          : "max-h-0 opacity-0 mb-0 pointer-events-none",
                      )}
                    >
                      {section.title}
                    </span>
                  )}

                  {visibleSectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const label = item.label(roles);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        title={label}
                        aria-label={label}
                        className={cn(
                          "h-11 flex items-center rounded-2xl text-sm font-semibold transition-all duration-200 relative cursor-pointer group",
                          isExpanded
                            ? "w-full justify-between px-3.5"
                            : "w-11 mx-auto justify-center px-0",
                          isActive
                            ? "bg-white text-slate-950 shadow-md shadow-white/10 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/8 active:bg-white/12",
                        )}
                      >
                        {/* Linha indicadora de item ativo */}
                        {isActive && isExpanded && (
                          <span className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-blue-600 rounded-full" />
                        )}

                        <div className="flex items-center justify-center">
                          <Icon
                            className={cn(
                              "w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105",
                              isActive
                                ? "text-slate-950 stroke-[2.2]"
                                : "text-slate-400 stroke-[1.8] group-hover:text-white",
                            )}
                          />
                          <span
                            className={cn(
                              "inline-block whitespace-nowrap overflow-hidden text-left transition-all duration-300 ease-in-out select-none",
                              isExpanded
                                ? "max-w-[180px] opacity-100 ml-3"
                                : "max-w-0 opacity-0 ml-0 pointer-events-none",
                            )}
                          >
                            {label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bloco Inferior: Perfil do Usuário com Logout */}
        <div className="pt-3 border-t border-slate-800/80 shrink-0">
          <div
            className={cn(
              "flex items-center rounded-2xl bg-white/5 border border-white/5 transition-all duration-300",
              isExpanded ? "justify-between p-2.5" : "justify-center p-1.5 w-11 h-11 mx-auto",
            )}
            title={!isExpanded ? user?.nome || "Usuário" : undefined}
          >
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/10 shrink-0 shadow-xs">
                {userInitial}
              </div>

              <div
                className={cn(
                  "flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
                  isExpanded
                    ? "max-w-[140px] opacity-100 ml-2.5"
                    : "max-w-0 opacity-0 ml-0 pointer-events-none",
                )}
              >
                <span className="text-xs font-bold text-white leading-tight truncate">
                  {user?.nome || "Usuário"}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight truncate">
                  {activeRoleName ? roleDisplayMap[activeRoleName] || activeRoleName : ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className={cn(
                "rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-300 cursor-pointer shrink-0",
                isExpanded
                  ? "opacity-100 scale-100 p-1.5 ml-2"
                  : "opacity-0 scale-75 pointer-events-none w-0 p-0 ml-0 overflow-hidden",
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
