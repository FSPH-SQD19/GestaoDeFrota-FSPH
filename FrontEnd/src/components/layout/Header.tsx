import React from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import type { UserRole } from "../../types/auth";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor de frota",
  MOTORISTA: "Motorista",
  SVO: "Atendente SVO",
  SOLICITANTE: "Solicitante Setor",
};

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user } = useAuth();
  const activeRole = user?.roles[0];
  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : "?";

  return (
    <header className="flex w-full items-center justify-between pb-4 select-none">
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-800 shadow-2xs transition-colors hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-extrabold tracking-tight text-slate-900">ROTA · FSPH</span>
      </div>

      <div className="hidden lg:block" />

      <div className="ml-auto flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 shadow-2xs">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {userInitial}
        </div>
        <div className="flex flex-col pr-1 text-left">
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
