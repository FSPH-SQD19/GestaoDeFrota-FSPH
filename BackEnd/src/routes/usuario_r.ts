import { Router } from "express";
import {
  atualizarUsuarioController,
  criarUsuarioController,
  inativarUsuarioController,
  listarUsuariosController,
  obterUsuarioController,
} from "../controller/usuario_c";
import { AuthToken } from "../middleware/auth_m";
import { requireRole } from "../middleware/http_m";

const router = Router();
router.use(AuthToken, requireRole("ADMIN"));

router.get("/", listarUsuariosController);
router.get("/:id", obterUsuarioController);
router.post("/", criarUsuarioController);
router.patch("/:id", atualizarUsuarioController);
router.delete("/:id", inativarUsuarioController);

export default router;
