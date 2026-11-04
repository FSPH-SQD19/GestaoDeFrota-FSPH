import { Router } from "express";
import {
  atualizarUsuarioController,
  criarUsuarioController,
  inativarUsuarioController,
  listarUsuariosController,
  obterUsuarioController,
} from "../controller/usuario_c";
import { authenticate, requireRole } from "../middleware/http_m";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get("/", listarUsuariosController);
router.get("/:id", obterUsuarioController);
router.post("/", criarUsuarioController);
router.patch("/:id", atualizarUsuarioController);
router.delete("/:id", inativarUsuarioController);

export default router;
