import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  remanejarOrdemSvoController,
  listarRemanejamentosSvoController,
  listarMinhasOrdensSvoController,
  indicadoresSvoController,
  listarChamadosSvoController,
  registrarChamadoSvoController,
  triagemSvoController,
  emitirOrdemSvoController,
  criarOrdemSvoController,
  avancarEtapaColetaSvoController,
  cancelarOrdemSvoController,
  concluirColetaSvoController,
  concluirDesinfeccaoSvoController,
  listarViaturasSvoController,
  listarMotoristasSvoController,
  obterChamadoSvoController,
  complementarChamadoSvoController,
} from "../controller/svo_c";

const router = Router();
router.use(authenticate);
router.get("/ordens-coleta/minhas", requireRole("MOTORISTA"), listarMinhasOrdensSvoController);
router.patch(
  "/ordens-coleta/:id/etapa",
  requireRole("ADMIN", "SVO", "MOTORISTA"),
  avancarEtapaColetaSvoController,
);

// Solicitantes podem acompanhar e criar apenas suas solicitações; a autorização
// por proprietário é aplicada também no serviço antes de serializar os dados.
router.get("/chamados", requireRole("ADMIN", "SVO", "SOLICITANTE"), listarChamadosSvoController);
router.post("/chamados", requireRole("ADMIN", "SVO", "SOLICITANTE"), registrarChamadoSvoController);
router.get("/chamados/:id", requireRole("ADMIN", "SVO", "SOLICITANTE"), obterChamadoSvoController);
router.post(
  "/chamados/:id/complementacao",
  requireRole("ADMIN", "SVO"),
  complementarChamadoSvoController,
);

router.use(requireRole("ADMIN", "SVO"));

router.patch("/ordens-coleta/:id/remanejamento", remanejarOrdemSvoController);
router.get("/ordens-coleta/:id/remanejamentos", listarRemanejamentosSvoController);

router.get("/indicadores", indicadoresSvoController);
router.get("/viaturas", listarViaturasSvoController);
router.get("/motoristas", listarMotoristasSvoController);

router.post("/ordens-coleta", criarOrdemSvoController);
router.patch("/ordens-coleta/:id/cancelar", cancelarOrdemSvoController);
router.post("/chamados/:id/ordens", emitirOrdemSvoController);

router.patch("/chamados/:id/triagem", triagemSvoController);
router.patch("/chamados/:id/concluir", concluirColetaSvoController);
router.patch("/viaturas/:id/desinfeccao", concluirDesinfeccaoSvoController);

export default router;
