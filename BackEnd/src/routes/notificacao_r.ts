import { Router } from "express";
import { authenticate } from "../middleware/http_m";
import {
  listarNotificacoesController,
  marcarNotificacaoLidaController,
  marcarTodasNotificacoesLidasController,
} from "../controller/notificacao_c";

const router = Router();

router.use(authenticate);
router.get("/", listarNotificacoesController);
router.patch("/ler-todas", marcarTodasNotificacoesLidasController);
router.patch("/:id/lida", marcarNotificacaoLidaController);

export default router;
