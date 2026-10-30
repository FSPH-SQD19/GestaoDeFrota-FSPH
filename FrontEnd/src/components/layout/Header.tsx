import React from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import type { UserRole } from "../../types/auth";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user } = useAuth();
  const activeRole = user?.roles[0];

  const roleLabels: Record<UserRole, string> = {
    ADMIN: "Administrador",
    GESTOR: "Gestor de frota",
    MOTORISTA: "Motorista",
    ATENDENTE_SVO: "Atendente SVO",
    SOLICITANTE: "Solicitante Setor",
  };

  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : "?";

  return (
    <header className="w-full flex items-center justify-between pb-4 select-none">
      {/* Botão Menu para Mobile */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-extrabold text-base tracking-tight text-slate-900">ROTA · FSPH</span>
      </div>

      <div className="hidden lg:block" />

      {/* Perfil autenticado */}
      <div className="ml-auto flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 shadow-2xs">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {userInitial}
        </div>
        <div className="flex flex-col text-left pr-1">
          <span className="text-xs font-bold leading-tight text-slate-900">
            {user?.nome || "Usuário"}
          </span>
          <span className="text-[10px] font-medium leading-tight text-slate-500">
            {activeRole ? roleLabels[activeRole] || activeRole : ""}
          </span>
        </div>
      </div>
    </header>
  );
};
