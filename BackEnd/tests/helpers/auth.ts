import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
const sessions = new Map<string, { id: string; perfis: string[]; sessaoId: string }>();
export function signTestToken(
  payload: string | object,
  secret: jwt.Secret,
  options: jwt.SignOptions = {},
) {
  const id = randomUUID();
  const data = typeof payload === "object" ? (payload as { perfis?: string[]; sub?: string }) : {};
  sessions.set(id, {
    id: options.subject || data.sub || "",
    perfis: data.perfis || [],
    sessaoId: id,
  });
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    issuer: "fsph-frota-api",
    audience: "fsph-frota-web",
    expiresIn: 28800,
    jwtid: id,
    ...options,
  });
}
export async function resolveTestSession(usuarioId: string, id: string) {
  const session = sessions.get(id);
  return session?.id === usuarioId ? session : null;
}
