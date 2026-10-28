import { Router } from "express";
import { atualizarVeiculoController } from "../controller/veiculo_c";

const router = Router();

router.patch("/:id", atualizarVeiculoController);

export default router;
