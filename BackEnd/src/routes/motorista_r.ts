import { Router } from "express";
import {
  listarMotoristasController,
  cadastrarMotoristaController,
  atualizarMotoristaController,
} from "../controller/motorista_c";
import { AuthToken } from "../middleware/auth_m";
import { autorizarPerfis } from "../middleware/RBAC_m";

const router = Router();

router.get("/", AuthToken, autorizarPerfis("ADMIN", "GESTOR"), listarMotoristasController);

router.post("/", AuthToken, autorizarPerfis("ADMIN", "GESTOR"), cadastrarMotoristaController);

router.patch("/:id", AuthToken, autorizarPerfis("ADMIN", "GESTOR"), atualizarMotoristaController);

export default router;
