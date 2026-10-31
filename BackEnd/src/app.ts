import express from "express";
import cors from "cors";
import { allowedOrigins, protectRequests } from "./middleware/session_http";
import routes from "./routes";
import { errorHandler } from "./middleware/http_m";
import motoristaRoutes from "./routes/motorista_r";
import veiculoRoutes from "./routes/veiculo_r";
import fornecedorRoutes from "./routes/fornecedor_r";
import svoRoutes from "./routes/svo_r";

export const app = express();

// Defina TRUST_PROXY_HOPS somente com o número exato de proxies confiáveis.
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 1) throw new Error("TRUST_PROXY_HOPS inválido.");
  app.set("trust proxy", hops);
}
app.use(
  cors({
    origin: allowedOrigins(),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(protectRequests);
app.use(routes);
app.use("/api/v1/motoristas", motoristaRoutes);
app.use("/api/v1/veiculos", veiculoRoutes);
app.use("/api/v1/fornecedores", fornecedorRoutes);

app.use("/api/v1/svo", svoRoutes);
app.use(errorHandler);
