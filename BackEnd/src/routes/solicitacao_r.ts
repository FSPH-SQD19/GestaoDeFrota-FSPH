import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  listarSolicitacoesController,
  criarSolicitacaoController,
  aprovarSolicitacaoController,
  recusarSolicitacaoController,
} from "../controller/solicitacao_c";

const router = Router();

router.get(
  "/",
  authenticate,
  requireRole("SOLICITANTE", "GESTOR", "ADMIN"),
  listarSolicitacoesController,
);

router.post(
  "/",
  authenticate,
  requireRole("SOLICITANTE", "GESTOR", "ADMIN"),
  criarSolicitacaoController,
);

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
