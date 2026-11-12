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

  // No mobile: expande quando a gaveta está aberta.
  // No desktop: recolhida por padrão (rail 68px), expande suavemente por hover ou quando fixada (pin).
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

  const handleFocus = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsHovered(true);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth >= 1024 &&
      !event.currentTarget.contains(event.relatedTarget as Node | null)
    ) {
      setIsHovered(false);
    }
  };

  return (
    <>
      {/* Espaçador no fluxo desktop: evita reflow/pulo do conteúdo principal durante o hover */}
      <div
        aria-hidden="true"
        className={cn(
          "hidden lg:block shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isPinned ? "w-[240px]" : "w-[84px]",
        )}
      />

      {/* Backdrop escuro para telas mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 transition-opacity duration-200 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Operacional Dark — geometria fixa p-3 para ícones 100% estáveis */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
        className={cn(
          "fixed top-3 left-3 z-50 h-[calc(100vh-1.5rem)] bg-[#0B0F19] text-white rounded-2xl p-3 flex flex-col justify-between border border-slate-800 shrink-0 select-none overflow-hidden",
          "transition-[width,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]",
          isExpanded ? "w-60 lg:w-56 shadow-xl" : "w-[68px] shadow-md",
          isMobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0",
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header da Sidebar: Logo ancorada em slot fixo de 44px + Título com fade suave */}
          <div className="flex items-center justify-between h-11 shrink-0">
            <div className="flex items-center min-w-0">
              <div
                className="w-11 h-11 rounded-xl bg-white p-2 flex items-center justify-center shrink-0 border border-slate-200 cursor-pointer"
                onClick={() => onSelectTab(telaInicial(roles))}
                title="ROTA · Frota FSPH"
              >
                <img src={rotaSymbol} alt="Símbolo Rota" className="w-full h-full object-contain" />
              </div>

              {/* Título ROTA FSPH */}
              <div
                className={cn(
                  "flex flex-col whitespace-nowrap overflow-hidden transition-[opacity,transform,max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isExpanded
                    ? "max-w-[130px] opacity-100 translate-x-0 ml-2.5"
                    : "max-w-0 opacity-0 -translate-x-2 ml-0 pointer-events-none",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white tracking-tight leading-tight">
                    ROTA
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-slate-400">FSPH</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight truncate">
                  Frota & SVO
                </span>
              </div>
            </div>

            {/* Botão de Fixar / Desafixar no Desktop */}
            <button
              type="button"
              onClick={() => setIsPinned((prev) => !prev)}
              aria-pressed={isPinned}
              tabIndex={isExpanded ? 0 : -1}
              className={cn(
                "hidden lg:flex p-1.5 rounded-lg transition-[opacity,transform,background-color,color] duration-200 cursor-pointer shrink-0",
                isExpanded
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 pointer-events-none w-0 p-0 overflow-hidden",
                isPinned
                  ? "text-white bg-slate-800 hover:bg-slate-700"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80",
              )}
              title={isPinned ? "Desafixar menu (recolher ao tirar o mouse)" : "Fixar menu aberto"}
              aria-label={isPinned ? "Desafixar menu" : "Fixar menu"}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="border-t border-slate-800/80 my-2.5 shrink-0" />

          {/* Navegação Estruturada por Seções (sem deslocamento vertical no hover) */}
          <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {NAV_SECTIONS.map((section, sIndex) => {
              const visibleSectionItems = itensVisiveis(section, roles);
              if (visibleSectionItems.length === 0) return null;

              return (
                <div key={sIndex} className="space-y-0.5">
                  {section.title && (
                    <div className="relative h-5 flex items-center select-none overflow-hidden">
                      <span
                        className={cn(
                          "absolute left-3.5 w-4 h-px bg-slate-800 transition-opacity duration-200",
                          isExpanded ? "opacity-0" : "opacity-100",
                        )}
                      />
                      <span
                        className={cn(
                          "px-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap transition-[opacity,transform] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          isExpanded
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 -translate-x-1 pointer-events-none",
                        )}
                      >
                        {section.title}
                      </span>
                    </div>
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
                          "w-full h-10 flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150 relative cursor-pointer group overflow-hidden",
                          isActive
                            ? "bg-white text-slate-950 font-semibold"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/70",
                        )}
                      >
                        {isActive && isExpanded && (
                          <span className="absolute left-1 top-2.5 bottom-2.5 w-0.5 bg-blue-700 rounded-full" />
                        )}

                        <span className="w-11 h-10 flex items-center justify-center shrink-0">
                          <Icon
                            className={cn(
                              "w-[18px] h-[18px] shrink-0",
                              isActive
                                ? "text-slate-950 stroke-[2.1]"
                                : "text-slate-400 stroke-[1.8] group-hover:text-white",
                            )}
                          />
                        </span>

                        <span
                          className={cn(
                            "whitespace-nowrap overflow-hidden text-left truncate pr-2.5 transition-[opacity,transform] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] select-none",
                            isExpanded
                              ? "opacity-100 translate-x-0"
                              : "opacity-0 -translate-x-2 pointer-events-none",
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bloco Inferior: Perfil do Usuário com Logout */}
        <div className="pt-2.5 border-t border-slate-800/80 shrink-0">
          <div
            className="w-full h-11 flex items-center justify-between rounded-lg bg-slate-900/90 border border-slate-800 overflow-hidden"
            title={!isExpanded ? user?.nome || "Usuário" : undefined}
          >
            <div className="flex items-center min-w-0">
              <div className="w-11 h-11 flex items-center justify-center shrink-0">
                <div className="w-7 h-7 rounded-md bg-slate-800 text-white flex items-center justify-center font-semibold text-xs border border-slate-700 shrink-0">
                  {userInitial}
                </div>
              </div>

              <div
                className={cn(
                  "flex flex-col whitespace-nowrap overflow-hidden transition-[opacity,transform] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 pointer-events-none",
                )}
              >
                <span className="text-xs font-semibold text-white leading-tight truncate max-w-[105px]">
                  {user?.nome || "Usuário"}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[105px]">
                  {activeRoleName ? roleDisplayMap[activeRoleName] || activeRoleName : ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              tabIndex={isExpanded ? 0 : -1}
              className={cn(
                "rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-[opacity,transform,color,background-color] duration-200 cursor-pointer shrink-0 mr-1.5",
                isExpanded
                  ? "opacity-100 scale-100 p-1.5"
                  : "opacity-0 scale-75 pointer-events-none w-0 p-0 mr-0 overflow-hidden",
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
