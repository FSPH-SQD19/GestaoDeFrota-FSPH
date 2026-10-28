import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middleware/http_m";
import motoristaTesteRoutes from "./routes/motoristateste_r";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(errorHandler);
app.use("/api/teste", motoristaTesteRoutes);
