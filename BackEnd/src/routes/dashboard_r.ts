import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import { resumoDashboardController } from "../controller/dashboard_c";

const router = Router();
router.get("/resumo", authenticate, requireRole("ADMIN", "GESTOR"), resumoDashboardController);
export default router;
