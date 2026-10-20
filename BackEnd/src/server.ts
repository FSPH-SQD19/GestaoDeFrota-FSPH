import "dotenv/config";
import { app } from "./app";
import { getAuthConfig } from "./config/auth";

getAuthConfig();

const port = Number(process.env.PORT ?? 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend executando na porta ${port}`);
});
