import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSameDatabase, prepareHmlDatabase } from "./check-hml-database.mjs";
const origin = { host: "ep-test.region.aws.neon.tech", database: "neondb" };
const url = "postgresql://user:secret@ep-test.region.aws.neon.tech/neondb?sslmode=require";
const env = {
  CLOUDFLARE_ACCOUNT_ID: "account",
  CLOUDFLARE_API_TOKEN: "secret",
  DATABASE_URL_MIGRATIONS: url,
  JWT_SECRET: "a".repeat(128),
};
test("aceita o mesmo destino Neon com ou sem pooling", () => {
  assert.doesNotThrow(() => assertSameDatabase(url, { origin }));
  assert.doesNotThrow(() =>
    assertSameDatabase(url.replace("ep-test.", "ep-test-pooler."), { origin }),
  );
});
test("recusa branch ou banco diferente antes de aplicar migrations", () => {
  assert.throws(
    () => assertSameDatabase(url.replace("ep-test.", "ep-other."), { origin }),
    /bancos diferentes/,
  );
  assert.throws(
    () => assertSameDatabase(url.replace("/neondb", "/other"), { origin }),
    /bancos diferentes/,
  );
});
test("desativa cache sem alterar a origem e confere o resultado", async () => {
  const calls = [];
  await prepareHmlDatabase(env, async (_url, options) => {
    calls.push(options);
    return Response.json({
      success: true,
      result: { origin, caching: { disabled: calls.length === 3 } },
    });
  });
  assert.deepEqual(
    calls.map((call) => call.method),
    ["GET", "PATCH", "GET"],
  );
  assert.deepEqual(JSON.parse(calls[1].body), { caching: { disabled: true } });
});
test("recusa erro de configuração e não chama a API", async () => {
  await assert.rejects(
    prepareHmlDatabase({ ...env, JWT_SECRET: "fraca" }, () => {
      throw new Error("API não deve ser chamada");
    }),
    /128 caracteres/,
  );
});
test("não altera o Hyperdrive se o banco não corresponde", async () => {
  const methods = [];
  await assert.rejects(
    prepareHmlDatabase(env, async (_url, options) => {
      methods.push(options.method);
      return Response.json({ success: true, result: { origin: { ...origin, database: "other" } } });
    }),
    /bancos diferentes/,
  );
  assert.deepEqual(methods, ["GET"]);
});

test("recusa porta diferente para o mesmo host e database", () => {
  assert.throws(
    () => assertSameDatabase(url.replace("/neondb", ":5433/neondb"), { origin }),
    /bancos diferentes/,
  );
});
