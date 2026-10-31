import { Router } from "express";
import {
  listarFornecedoresController,
  cadastrarFornecedorController,
  atualizarFornecedorController,
  inativarFornecedorController,
} from "../controller/fornecedor_c";

import { requireRole } from "../middleware/http_m";
import { AuthToken } from "../middleware/auth_m";

const router = Router();
router.use(AuthToken, requireRole("ADMIN", "GESTOR"));

router.get("/", listarFornecedoresController);

router.post("/", cadastrarFornecedorController);

router.patch("/:id", atualizarFornecedorController);

router.delete("/:id", inativarFornecedorController);

export default router;
