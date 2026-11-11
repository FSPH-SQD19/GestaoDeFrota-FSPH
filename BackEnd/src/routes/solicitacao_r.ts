import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  listarSolicitacoesController,
  criarSolicitacaoController,
  aprovarSolicitacaoController,
  recusarSolicitacaoController,
  cancelarSolicitacaoController,
  listarMinhasViagensController,
  iniciarViagemController,
  concluirViagemController,
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

router.patch(
  "/:id/cancelar",
  authenticate,
  requireRole("SOLICITANTE", "GESTOR", "ADMIN"),
  cancelarSolicitacaoController,
);

router.get("/minhas", authenticate, requireRole("MOTORISTA"), listarMinhasViagensController);
router.post("/:id/iniciar", authenticate, requireRole("MOTORISTA"), iniciarViagemController);
router.post("/:id/concluir", authenticate, requireRole("MOTORISTA"), concluirViagemController);

export default router;
