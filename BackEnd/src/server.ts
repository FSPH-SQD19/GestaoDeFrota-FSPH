import "dotenv/config";
import { allowedOrigins } from "./middleware/session_http";
import { app } from "./app";
import { getAuthConfig } from "./config/auth";
import { initializePrisma } from "./lib/prisma";

getAuthConfig();
allowedOrigins();
initializePrisma(process.env.DATABASE_URL ?? "");

const port = Number(process.env.PORT ?? 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend executando na porta ${port}`);
});
