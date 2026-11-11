import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import { listarAuditoriaController } from "../controller/auditoria_c";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));
router.get("/", listarAuditoriaController);

export default router;
