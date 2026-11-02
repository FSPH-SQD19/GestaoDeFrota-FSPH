import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { ROTULOS_PERFIL } from "../../types/auth";
import { MinhaContaModal } from "./MinhaContaModal";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const activeRole = user?.roles[0];
  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : "?";

  const [menuAberto, setMenuAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;

    function aoClicarFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    }

    function aoPressionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAberto(false);
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [menuAberto]);

  return (
    <>
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
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            ROTA · FSPH
          </span>
        </div>

        <div className="hidden lg:block" />

        <div ref={menuRef} className="relative ml-auto">
          <button
            type="button"
            aria-label="Menu da conta"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((aberto) => !aberto)}
            className="flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {userInitial}
            </div>
            <div className="flex flex-col pr-0.5 text-left">
              <span className="text-xs font-bold leading-tight text-slate-900">
                {user?.nome || "Usuário"}
              </span>
              <span className="text-[10px] font-medium leading-tight text-slate-500">
                {activeRole ? ROTULOS_PERFIL[activeRole] || activeRole : ""}
              </span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                menuAberto ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuAberto && (
            <div
              role="menu"
              aria-label="Opções da conta"
              className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              {user?.email && (
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-xs font-bold text-slate-900">{user.nome}</p>
                  <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                </div>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  setModalContaAberto(true);
                }}
                className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <KeyRound className="h-4 w-4 text-slate-500" />
                <span>Minha Conta / Alterar Senha</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false);
                  void logout();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-rose-600" />
                <span>Sair da conta</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <MinhaContaModal
        isOpen={modalContaAberto}
        usuario={user}
        onClose={() => setModalContaAberto(false)}
      />
    </>
  );
};
