import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type AuthConfig = { secret: string; expiresIn: number };
let config: AuthConfig | undefined;

export function loadAuthConfig(directory = resolve(__dirname, "../../.runtime")): AuthConfig {
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

export function configureAuthConfig(secret: string): void {
    if (!/^[a-f0-9]{128}$/.test(secret)) {
        throw new Error("JWT_SECRET deve conter 64 bytes aleatórios em hexadecimal.");
    }
    if (config && config.secret !== secret) {
        throw new Error("JWT_SECRET mudou durante a execução do Worker.");
    }
    config ??= { secret, expiresIn: 8 * 60 * 60 };
}
