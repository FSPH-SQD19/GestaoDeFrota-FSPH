import React, { useState } from 'react'
import type { User, UserRole, LoginCredentials, AuthState } from '../types/auth'
import { AuthContext } from './auth'

const STORAGE_KEY_USER = '@fsph_frota_user'
const STORAGE_KEY_TOKEN = '@fsph_frota_token'

const validRoles = new Set(['ADMIN', 'GESTOR', 'MOTORISTA', 'ATENDENTE_SVO', 'SOLICITANTE'])

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)
  } catch {
    // A sessão em memória continua funcionando quando o navegador bloqueia o armazenamento.
  }
}

function saveSession(user: User, token: string) {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
    localStorage.setItem(STORAGE_KEY_TOKEN, token)
  } catch {
    // O usuário precisará entrar novamente após recarregar a página.
  }
}

function isStoredUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<User>
  return typeof user.id === 'string' && typeof user.nome === 'string' &&
    typeof user.email === 'string' && Array.isArray(user.roles) &&
    user.roles.length > 0 && user.roles.every(role => validRoles.has(role))
}

function readSession(): AuthState {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY_USER)
    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (storedUser && storedToken) {
      const user: unknown = JSON.parse(storedUser)
      if (isStoredUser(user)) {
        return { user, token: storedToken, isAuthenticated: true, isLoading: false }
      }
    }
  } catch {
    // JSON inválido ou armazenamento indisponível: voltar ao login.
  }
  clearSession()
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(readSession)
  const login = async ({ usuario, senha }: LoginCredentials) => {
    // Simulação com delay de rede (ou chamada à API se backend estiver pronto)
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (!usuario || !senha) {
      throw new Error('Informe o usuário e a senha.')
    }

    // Criar usuário padrão do protótipo (Vitor - Gestor de Frota)
    // Suporta qualquer login de teste ou credenciais
    let userRoles: UserRole[] = ['GESTOR', 'ADMIN']
    let userName = 'Vitor Santos'

    const lowerUser = usuario.toLowerCase()
    if (lowerUser.includes('motorista')) {
      userRoles = ['MOTORISTA']
      userName = 'Carlos Alberto (Motorista)'
    } else if (lowerUser.includes('svo')) {
      userRoles = ['ATENDENTE_SVO']
      userName = 'Ana Paula (Atendente SVO)'
    } else if (lowerUser.includes('solicitante')) {
      userRoles = ['SOLICITANTE']
      userName = 'Marina Costa (LACEN)'
    } else if (lowerUser.includes('admin')) {
      userRoles = ['ADMIN']
      userName = 'Administrador FSPH'
    } else {
      userRoles = ['GESTOR', 'ADMIN']
      userName = 'Vitor Santos'
    }

    const mockUser: User = {
      id: `usr-${Date.now()}`,
      nome: userName,
      email: `${usuario.toLowerCase().replace(/\s+/g, '.')}@fsph.se.gov.br`,
      roles: userRoles,
    }

    const mockToken = `mock-jwt-token-${Date.now()}`

    saveSession(mockUser, mockToken)

    setState({
      user: mockUser,
      token: mockToken,
      isAuthenticated: true,
      isLoading: false,
    })
  }

  const logout = () => {
    clearSession()
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }

  // Verificação RBAC: checa se o usuário possui algum dos papéis necessários
  const hasRole = (requiredRoles: UserRole[]): boolean => {
    if (!state.user) return false
    if (requiredRoles.length === 0) return true
    return state.user.roles.some((role) => requiredRoles.includes(role))
  }

  // Utilitário para desenvolvedores testarem os menus com outros perfis
  const switchRoleForTesting = (role: UserRole) => {
    if (!state.user) return
    const updatedUser: User = {
      ...state.user,
      roles: [role],
    }
    if (state.token) saveSession(updatedUser, state.token)
    setState((prev) => ({ ...prev, user: updatedUser }))
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasRole,
        switchRoleForTesting,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

