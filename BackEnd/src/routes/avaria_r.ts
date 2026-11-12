import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  analisarAvariaController,
  historicoAvariaController,
  listarAvariasController,
  listarVeiculosComAvariaController,
} from "../controller/avaria_c";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "GESTOR"));
router.get("/veiculos", listarVeiculosComAvariaController);
router.get("/", listarAvariasController);
router.get("/:id/historico", historicoAvariaController);
router.patch("/:id/analisar", analisarAvariaController);

export default router;
