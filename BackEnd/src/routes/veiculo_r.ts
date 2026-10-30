import { authenticate, requireRole } from "../middleware/http_m";
import { Router } from "express";
import { atualizarVeiculoController } from "../controller/veiculo_c";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "GESTOR"));

router.patch("/:id", atualizarVeiculoController);

export default router;
