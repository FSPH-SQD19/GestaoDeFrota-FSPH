import { Router } from "express";
import {
  atualizarMultaController,
  criarMultaController,
  listarMultasController,
  obterMultaController,
  resumoMultasMotoristaController,
} from "../controller/multa_c";
import { authenticate, requireRole } from "../middleware/http_m";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "GESTOR"));

router.get("/", listarMultasController);
router.get("/motorista/:motoristaId", resumoMultasMotoristaController);
router.get("/:id", obterMultaController);
router.post("/", criarMultaController);
router.patch("/:id", atualizarMultaController);

export default router;
