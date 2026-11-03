import { authenticate, requireRole } from "../middleware/http_m";
import { Router } from "express";
import {
  atualizarVeiculoController,
  criarVeiculoController,
  listarVeiculosController,
} from "../controller/veiculo_c";

import {
  criarDocumentoVeiculoController,
  listarDocumentosVeiculoController,
} from "../controller/documento_veiculo_c";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "GESTOR"));

router.get("/", listarVeiculosController);
router.post("/", criarVeiculoController);
router.get("/:id/documentos", listarDocumentosVeiculoController);
router.post("/:id/documentos", criarDocumentoVeiculoController);
router.patch("/:id", atualizarVeiculoController);

export default router;
