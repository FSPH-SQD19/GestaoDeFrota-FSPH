import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type AuthConfig = { secret: string; expiresIn: number };
let config: AuthConfig | undefined;

export function loadAuthConfig(directory = resolve(__dirname, "../../.runtime")): AuthConfig {
  const configured = process.env.JWT_SECRET;
  if (configured !== undefined) {
    if (!/^[a-f0-9]{128}$/.test(configured))
      throw new Error("JWT_SECRET deve conter 128 caracteres hexadecimais aleatórios.");
    return { secret: configured, expiresIn: 8 * 60 * 60 };
  }
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "JWT_SECRET é obrigatória em produção e deve ser compartilhada entre réplicas.",
    );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyPath = join(directory, "auth.key");
  try {
    writeFileSync(keyPath, randomBytes(64).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  const secret = readFileSync(keyPath, "utf8");
  if (!/^[a-f0-9]{128}$/.test(secret)) {
    throw new Error("Chave de autenticação local inválida.");
  }
  return { secret, expiresIn: 8 * 60 * 60 };
}

export function getAuthConfig(): AuthConfig {
  config ??= loadAuthConfig();
  return config;
}
