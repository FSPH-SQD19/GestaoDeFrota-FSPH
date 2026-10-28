import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middleware/http_m";
import motoristaRoutes from "./routes/motorista_r";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(errorHandler);
app.use("/api/v1/motoristas", motoristaRoutes);
