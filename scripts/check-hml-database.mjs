import { parse } from "jsonc-parser";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function canonicalHost(host) {
  const normalized = host.toLowerCase();
  return normalized.endsWith(".neon.tech") ? normalized.replace(/-pooler(?=\.)/, "") : normalized;
}
export function assertSameDatabase(connectionString, config) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("HML exige uma conexão PostgreSQL para migrations.");
  if (
    !config?.origin?.host ||
    !config.origin.database ||
    canonicalHost(url.hostname) !== canonicalHost(config.origin.host) ||
    (url.port || "5432") !== String(config.origin.port || 5432) ||
    decodeURIComponent(url.pathname.slice(1)) !== config.origin.database
  )
    throw new Error(
      "DATABASE_URL_MIGRATIONS e Hyperdrive apontam para bancos diferentes. Deploy interrompido.",
    );
}
export async function prepareHmlDatabase(env = process.env, apiFetch = fetch) {
  for (const key of [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "DATABASE_URL_MIGRATIONS",
    "JWT_SECRET",
  ]) {
    if (!env[key]?.trim()) {
      const location = key === "CLOUDFLARE_ACCOUNT_ID" ? "como secret ou variável" : "como secret";
      throw new Error(`Configure ${key} ${location} no ambiente hml do GitHub.`);
    }
  }
  if (!/^[a-f0-9]{128}$/.test(env.JWT_SECRET))
    throw new Error("JWT_SECRET deve conter 128 caracteres hexadecimais aleatórios.");
  const config = parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const binding = config.env.hml.hyperdrive.find((item) => item.binding === "HYPERDRIVE");
  if (!binding?.id) throw new Error("Binding HYPERDRIVE ausente no Wrangler.");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/hyperdrive/configs/${encodeURIComponent(binding.id)}`;
  async function request(method, body) {
    const response = await apiFetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(
        `Falha ao consultar/configurar Hyperdrive (HTTP ${response.status}). Verifique as permissões de Hyperdrive do token Cloudflare.`,
      );
    return data.result;
  }
  const current = await request("GET");
  assertSameDatabase(env.DATABASE_URL_MIGRATIONS, current);
  if (!current.caching?.disabled) {
    await request("PATCH", { caching: { disabled: true } });
    const updated = await request("GET");
    if (!updated.caching?.disabled)
      throw new Error("Cache de consultas do Hyperdrive continua habilitado. Deploy interrompido.");
  }
  console.log(
    "Banco de HML conferido; cache de consultas desativado para manter sessões e permissões atuais.",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareHmlDatabase().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
