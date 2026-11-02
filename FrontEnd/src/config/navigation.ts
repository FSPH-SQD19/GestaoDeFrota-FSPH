import type React from "react";
import {
  LayoutGrid,
  Car,
  Users,
  ClipboardList,
  BarChart3,
  UserCheck,
  PhoneCall,
  Route,
} from "lucide-react";
import type { UserRole } from "../types/auth";

/**
 * Fonte única das regras de navegação por perfil (RBAC no front-end).
 * Sidebar e App leem daqui: o que aparece no menu é exatamente o que pode ser renderizado.
 * A autorização real das operações continua sendo responsabilidade da API.
 */

export type TabId =
  | "dashboard"
  | "solicitacoes"
  | "viagens"
  | "veiculos"
  | "motoristas"
  | "svo"
  | "relatorios"
  | "usuarios";

export interface NavItem {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  /** Rótulo pode variar conforme o perfil (ex.: "Minhas Solicitações" para o solicitante). */
  label: (roles: UserRole[]) => string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const isGestao = (roles: UserRole[]) => roles.includes("ADMIN") || roles.includes("GESTOR");

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      {
        id: "dashboard",
        label: () => "Dashboard",
        icon: LayoutGrid,
        roles: ["ADMIN", "GESTOR"],
      },
      {
        id: "solicitacoes",
        label: (roles) => (isGestao(roles) ? "Solicitações" : "Minhas Solicitações"),
        icon: ClipboardList,
        roles: ["ADMIN", "GESTOR", "SOLICITANTE"],
      },
      {
        id: "viagens",
        label: () => "Minhas Viagens",
        icon: Route,
        roles: ["MOTORISTA"],
      },
    ],
  },
  {
    title: "OPERAÇÃO DA FROTA",
    items: [
      {
        id: "veiculos",
        label: () => "Veículos",
        icon: Car,
        roles: ["ADMIN", "GESTOR"],
      },
      {
        id: "motoristas",
        label: () => "Motoristas",
        icon: Users,
        roles: ["ADMIN", "GESTOR"],
      },
      {
        id: "svo",
        label: () => "Módulo SVO",
        icon: PhoneCall,
        roles: ["ADMIN", "SVO"],
      },
    ],
  },
  {
    title: "GESTÃO & AUDITORIA",
    items: [
      {
        id: "relatorios",
        label: () => "Relatórios",
        icon: BarChart3,
        roles: ["ADMIN", "GESTOR"],
      },
      {
        id: "usuarios",
        label: () => "Usuários (RBAC)",
        icon: UserCheck,
        roles: ["ADMIN"],
      },
    ],
  },
];

/** Tela aberta após o login, por perfil. */
export const TELA_INICIAL_POR_PERFIL: Record<UserRole, TabId> = {
  ADMIN: "dashboard",
  GESTOR: "dashboard",
  SVO: "svo",
  MOTORISTA: "viagens",
  SOLICITANTE: "solicitacoes",
};

/** Ordem de prioridade quando o usuário possui mais de um perfil. */
const PRIORIDADE_PERFIS: UserRole[] = ["ADMIN", "GESTOR", "SVO", "MOTORISTA", "SOLICITANTE"];

const ROLES_POR_TAB = new Map<TabId, UserRole[]>(
  NAV_SECTIONS.flatMap((s) => s.items).map((item) => [item.id, item.roles]),
);

export function podeAcessar(tab: TabId, roles: UserRole[]): boolean {
  const permitidos = ROLES_POR_TAB.get(tab);
  return !!permitidos && roles.some((r) => permitidos.includes(r));
}

export function telaInicial(roles: UserRole[]): TabId {
  const principal = PRIORIDADE_PERFIS.find((r) => roles.includes(r));
  return principal ? TELA_INICIAL_POR_PERFIL[principal] : "dashboard";
}

export function itensVisiveis(section: NavSection, roles: UserRole[]): NavItem[] {
  return section.items.filter((item) => podeAcessar(item.id, roles));
}
