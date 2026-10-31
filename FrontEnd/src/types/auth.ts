// Perfis alinhados aos nomes da API e do banco (migration/seed).
export type UserRole = "ADMIN" | "GESTOR" | "MOTORISTA" | "SVO" | "SOLICITANTE";

export interface User {
  id: string;
  nome: string;
  email: string;
  roles: UserRole[];
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  sessionKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  usuario: string;
  senha: string;
}
