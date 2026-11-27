import { Router } from "express";
import {
  complementarSolicitacaoExternaController,
  criarSolicitacaoExternaController,
  detalharSolicitacaoExternaController,
  listarSolicitacoesExternasController,
} from "../controller/solicitacao_externa_c";
import { authenticate, requireRole } from "../middleware/http_m";

const router = Router();

// Portal externo: somente o perfil EXTERNO, sempre restrito às próprias solicitações.
router.use(authenticate, requireRole("EXTERNO"));

router.post("/", criarSolicitacaoExternaController);
router.get("/", listarSolicitacoesExternasController);
router.get("/:id", detalharSolicitacaoExternaController);
router.patch("/:id/complementacao", complementarSolicitacaoExternaController);

export default router;
