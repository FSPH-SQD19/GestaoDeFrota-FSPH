import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User, UserRole, LoginCredentials, AuthState } from '../types/auth'

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  hasRole: (requiredRoles: UserRole[]) => boolean
  switchRoleForTesting?: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY_USER = '@fsph_frota_user'
const STORAGE_KEY_TOKEN = '@fsph_frota_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // Carregar sessão salva no localStorage ao iniciar
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY_USER)
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN)

      if (storedUser && storedToken) {
        setState({
          user: JSON.parse(storedUser),
          token: storedToken,
          isAuthenticated: true,
          isLoading: false,
        })
        return
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_USER)
      localStorage.removeItem(STORAGE_KEY_TOKEN)
    }

    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  const login = async ({ usuario, senha }: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }))

    // Simulação com delay de rede (ou chamada à API se backend estiver pronto)
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (!usuario || !senha) {
      setState((prev) => ({ ...prev, isLoading: false }))
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

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockUser))
    localStorage.setItem(STORAGE_KEY_TOKEN, mockToken)

    setState({
      user: mockUser,
      token: mockToken,
      isAuthenticated: true,
      isLoading: false,
    })
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)
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
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser))
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
