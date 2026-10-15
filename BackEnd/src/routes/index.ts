import { Router } from "express";
import { healthController } from "../controller/health_c";
import authRoutes from "./auth_r";

const router = Router();

router.get("/health", healthController);
router.use("/auth", authRoutes);

export default router;