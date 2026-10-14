import { Router } from "express";
import { healthController } from "../controller/health_c";

const routes = Router();

routes.get("/health", healthController);

export default routes;