export type UserRole = "ADMIN" | "GESTOR" | "MOTORISTA" | "ATENDENTE_SVO" | "SOLICITANTE";

export interface User {
  id: string;
  nome: string;
  email: string;
  roles: UserRole[];
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  usuario: string;
  senha: string;
}
