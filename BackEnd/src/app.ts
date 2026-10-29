import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middleware/http_m";
import motoristaRoutes from "./routes/motorista_r";
import veiculoRoutes from "./routes/veiculo_r";
import fornecedorRoutes from "./routes/fornecedor_r";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(errorHandler);
app.use("/api/v1/motoristas", motoristaRoutes);
app.use("/api/v1/veiculos", veiculoRoutes);
app.use("/api/v1/fornecedores", fornecedorRoutes);