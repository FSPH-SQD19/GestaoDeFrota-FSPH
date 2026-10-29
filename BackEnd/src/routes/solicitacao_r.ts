import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  listarSolicitacoesController,
  criarSolicitacaoController,
  aprovarSolicitacaoController,
  recusarSolicitacaoController,
} from "../controller/solicitacao_c";

const router = Router();

router.get("/", authenticate, listarSolicitacoesController);

router.post("/", authenticate, criarSolicitacaoController);

router.patch(
  "/:id/aprovar",
  authenticate,
  requireRole("ADMIN", "GESTOR"),
  aprovarSolicitacaoController,
);

router.patch(
  "/:id/recusar",
  authenticate,
  requireRole("ADMIN", "GESTOR"),
  recusarSolicitacaoController,
);

export default router;
