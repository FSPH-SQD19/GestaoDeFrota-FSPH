import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const name = `rota-pwa-test-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("hex");
const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 120000, ...options });
  if (result.status !== 0)
    throw new Error(
      `${cmd} falhou: ${result.stdout || ""} ${result.stderr || result.error?.message || ""}`,
    );
  return result.stdout.trim();
};
let created = false;
try {
  run("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 15000 });
  created = true;
  run("docker", [
    "run",
    "--detach",
    "--name",
    name,
    "--publish",
    "127.0.0.1::5432",
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--env",
    "POSTGRES_DB=rota_driver_test",
    "postgis/postgis:16-3.5",
  ]);
  created = true;
  let ready = false;
  for (let n = 0; n < 60; n++) {
    const p = spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      {
        encoding: "utf8",
      },
    );
    if (p.status === 0) {
      ready = true;
      break;
    }
    await delay(1000);
  }
  if (!ready) throw new Error("PostGIS não iniciou em 60 segundos.");
  const port = run("docker", [
    "inspect",
    "--format",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    name,
  ]);
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/rota_driver_test`;
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: url,
    DATABASE_URL_MIGRATIONS: url,
    DRIVER_PWA_ENABLED: "true",
    DRIVER_INTEGRATION_ISOLATED: "true",
  };
  console.log("Aplicando migrations em PostGIS descartável...");
  run(process.execPath, ["../node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: "BackEnd",
    env,
  });
  console.log(
    run(
      process.execPath,
      ["../node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.mts"],
      { cwd: "BackEnd", env },
    ),
  );
} catch (error) {
  console.error(error.message.replaceAll(password, "[redacted]"));
  process.exitCode = 1;
} finally {
  if (created) {
    const cleanup = spawnSync("docker", ["rm", "--force", name], {
      encoding: "utf8",
      timeout: 15000,
    });
    if (cleanup.status !== 0)
      console.error(
        `Falha ao remover contêiner de teste ${name}: ${cleanup.stderr || cleanup.error?.message || "Docker indisponível"}`,
      );
  }
}
