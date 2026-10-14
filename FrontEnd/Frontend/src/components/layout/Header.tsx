import React, { useState } from 'react'
import { Bell, Menu, Shield } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { UserRole } from '../../types/auth'

interface HeaderProps {
  onToggleMobileMenu?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user, switchRoleForTesting } = useAuth()
  const [showRoleMenu, setShowRoleMenu] = useState(false)

  const activeRole = user?.roles[0] || 'GESTOR'

  const roleLabels: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    GESTOR: 'Gestor de frota',
    MOTORISTA: 'Motorista',
    ATENDENTE_SVO: 'Atendente SVO',
    SOLICITANTE: 'Solicitante Setor',
  }

  const userInitial = user?.nome ? user.nome.charAt(0).toUpperCase() : 'V'

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

      {/* Ações do Topo Direito (Figma) */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Notificação Bell Circular */}
        <button
          type="button"
          className="relative w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-black hover:border-slate-300 transition-colors shadow-2xs"
          aria-label="Notificações"
        >
          <Bell className="w-4.5 h-4.5 stroke-[1.8]" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* Pílula do Usuário Executiva / RBAC */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleMenu((prev) => !prev)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
            title="Clique para alternar o perfil de teste (RBAC)"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:bg-blue-600 transition-colors">
              {userInitial}
            </div>

            <div className="flex flex-col text-left pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.nome || 'Vitor'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                {roleLabels[activeRole] || activeRole}
              </span>
            </div>
          </button>

          {/* Menu Dropdown de teste de RBAC */}
          {showRoleMenu && switchRoleForTesting && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>Simular Perfil (RBAC)</span>
              </div>
              <div className="divide-y divide-slate-100 mt-1">
                {(['GESTOR', 'ADMIN', 'MOTORISTA', 'ATENDENTE_SVO', 'SOLICITANTE'] as UserRole[]).map(
                  (role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        switchRoleForTesting(role)
                        setShowRoleMenu(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${
                        activeRole === role
                          ? 'bg-black text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{roleLabels[role]}</span>
                      {activeRole === role && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
