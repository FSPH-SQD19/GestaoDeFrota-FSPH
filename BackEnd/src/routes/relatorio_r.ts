import { Router } from "express";
import { gerarRelatorioOperacionalController } from "../controller/relatorio_c";
import { authenticate, requireRole } from "../middleware/http_m";
import { relatorioAgregadoController } from "../controller/relatorio_agregacao_c";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "GESTOR"));
router.get(["/", "/operacional"], gerarRelatorioOperacionalController);
router.get("/consumo", relatorioAgregadoController("consumo"));
router.get("/manutencoes", relatorioAgregadoController("manutencoes"));
router.get("/viagens", relatorioAgregadoController("viagens"));

export default router;
