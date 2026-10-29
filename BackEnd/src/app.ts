import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middleware/http_m";
import motoristaRoutes from "./routes/motorista_r";
import veiculoRoutes from "./routes/veiculo_r";
import fornecedorRoutes from "./routes/fornecedor_r";
import svoRoutes from "./routes/svo_r";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use("/api/v1/motoristas", motoristaRoutes);
app.use("/api/v1/veiculos", veiculoRoutes);
app.use("/api/v1/fornecedores", fornecedorRoutes);

app.use("/api/v1/svo", svoRoutes);
app.use(errorHandler);
