import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
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
} from "../controller/svo_c";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "SVO"));

router.get("/indicadores", indicadoresSvoController);
router.get("/chamados", listarChamadosSvoController);
router.get("/viaturas", listarViaturasSvoController);
router.get("/motoristas", listarMotoristasSvoController);

router.post("/chamados", registrarChamadoSvoController);
router.post("/ordens-coleta", criarOrdemSvoController);
router.patch("/ordens-coleta/:id/etapa", avancarEtapaColetaSvoController);
router.patch("/ordens-coleta/:id/cancelar", cancelarOrdemSvoController);
router.post("/chamados/:id/ordens", emitirOrdemSvoController);

router.patch("/chamados/:id/triagem", triagemSvoController);
router.patch("/chamados/:id/concluir", concluirColetaSvoController);
router.patch("/viaturas/:id/desinfeccao", concluirDesinfeccaoSvoController);

export default router;
