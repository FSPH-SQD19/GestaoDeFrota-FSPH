import { Router } from "express";
import {
  listarFornecedoresController,
  cadastrarFornecedorController,
  atualizarFornecedorController,
  inativarFornecedorController,
} from "../controller/fornecedor_c";

import { AuthToken } from "../middleware/auth_m";

const router = Router();

router.get("/", AuthToken, listarFornecedoresController);

router.post("/", AuthToken, cadastrarFornecedorController);

router.patch("/:id", AuthToken, atualizarFornecedorController);

router.delete("/:id", AuthToken, inativarFornecedorController);

export default router;
