import { Router } from "express";
import { authenticate, requireRole } from "../middleware/http_m";
import {
  indicadoresSvoController, listarChamadosSvoController, registrarChamadoSvoController,
  triagemSvoController, emitirOrdemSvoController, listarViaturasSvoController,
  listarMotoristasSvoController,
} from "../controller/svo_c";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "SVO"));

router.get("/indicadores", indicadoresSvoController);
router.get("/chamados", listarChamadosSvoController);
router.get("/viaturas", listarViaturasSvoController);
router.get("/motoristas", listarMotoristasSvoController);

router.post("/chamados", registrarChamadoSvoController);
router.post("/chamados/:id/ordens", emitirOrdemSvoController);

router.patch("/chamados/:id/triagem", triagemSvoController);

export default router;
