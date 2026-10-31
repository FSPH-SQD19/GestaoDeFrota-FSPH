import type { UserRole } from "../../src/types/auth";
let roles: UserRole[] = ["GESTOR"];
export function setTestRoles(value: string[]) {
  roles = value as UserRole[];
}
export function getTestRoles() {
  return roles;
}
