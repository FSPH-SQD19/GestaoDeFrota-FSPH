import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAuthConfig } from "../../../src/config/auth";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "frota-auth-test-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("chave local de autenticação", () => {
  it("gera uma chave aleatória persistida com validade fixa de oito horas", () => {
    const config = loadAuthConfig(directory);
    expect(config.secret).toMatch(/^[a-f0-9]{128}$/);
    expect(readFileSync(join(directory, "auth.key"), "utf8")).toBe(config.secret);
    expect(config.expiresIn).toBe(28800);
  });

  it("reutiliza a chave em reinícios, mantendo os tokens válidos", () => {
    const first = loadAuthConfig(directory);
    const token = jwt.sign({ perfis: ["ADMIN"] }, first.secret, {
      subject: "sintetico",
      expiresIn: first.expiresIn,
    });
    const second = loadAuthConfig(directory);
    expect(second).toEqual(first);
    expect(jwt.verify(token, second.secret)).toMatchObject({ sub: "sintetico", perfis: ["ADMIN"] });
  });

  it("usa chaves diferentes para instalações independentes", () => {
    expect(loadAuthConfig(join(directory, "a")).secret).not.toBe(
      loadAuthConfig(join(directory, "b")).secret,
    );
  });

  it.each(["", "chave-curta", "g".repeat(128)])(
    "recusa arquivo inválido sem substituir a chave: %j",
    (value) => {
      writeFileSync(join(directory, "auth.key"), value);
      expect(() => loadAuthConfig(directory)).toThrow("Chave de autenticação local inválida.");
      expect(readFileSync(join(directory, "auth.key"), "utf8")).toBe(value);
    },
  );

  it("interrompe o carregamento quando não é possível criar o diretório", () => {
    const file = join(directory, "arquivo");
    writeFileSync(file, "sintetico");
    expect(() => loadAuthConfig(file)).toThrow();
  });
});

describe("chave compartilhada em produção", () => {
  it("exige secret configurado em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", undefined);
    expect(() => loadAuthConfig(directory)).toThrow("JWT_SECRET é obrigatória");
  });
  it("usa a mesma chave configurada independentemente do diretório", () => {
    vi.stubEnv("JWT_SECRET", "a".repeat(128));
    expect(loadAuthConfig(join(directory, "a")).secret).toBe(
      loadAuthConfig(join(directory, "b")).secret,
    );
  });
  it("recusa secret fraco", () => {
    vi.stubEnv("JWT_SECRET", "senha");
    expect(() => loadAuthConfig(directory)).toThrow("128 caracteres");
  });
});
