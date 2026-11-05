import { Router } from "express";
import { gerarRelatorioOperacionalController } from "../controller/relatorio_c";
import { authenticate, requireRole } from "../middleware/http_m";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "GESTOR"));
router.get(["/", "/operacional"], gerarRelatorioOperacionalController);

export default router;
