// Resposta do endpoint existente GET /api/v1/auth/perfil.
export interface PerfilAutenticadoResponse {
  usuario: {
    userId: string;
    perfis: string[];
  };
}
