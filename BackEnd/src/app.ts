import express from "express";
import cors from "cors";
import { allowedOrigins, protectRequests } from "./middleware/session_http";
import routes from "./routes";
import { errorHandler } from "./middleware/error_m";
import motoristaRoutes from "./routes/motorista_r";
import fornecedorRoutes from "./routes/fornecedor_r";
import usuarioRoutes from "./routes/usuario_r";
import multaRoutes from "./routes/multa_r";
import svoRoutes from "./routes/svo_r";
import { securityHeaders } from "./middleware/security_headers";

export const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);

// Defina TRUST_PROXY_HOPS somente com o número exato de proxies confiáveis.
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 1) throw new Error("TRUST_PROXY_HOPS inválido.");
  app.set("trust proxy", hops);
}
app.use(
  cors({
    origin: (origin, callback) => {
      try {
        callback(null, !origin || allowedOrigins().includes(origin));
      } catch (error) {
        callback(error as Error);
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);
app.use(express.json({ limit: "512kb" }));
app.use(protectRequests);
app.use(routes);
app.use("/api/v1/motoristas", motoristaRoutes);
app.use("/api/v1/fornecedores", fornecedorRoutes);
app.use("/api/v1/usuarios", usuarioRoutes);
app.use("/api/v1/multas", multaRoutes);

app.use("/api/v1/svo", svoRoutes);
app.use(errorHandler);
