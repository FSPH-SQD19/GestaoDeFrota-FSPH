import { Router } from "express";
import { loginController } from "../controller/auth_c";
import { authenticate, requireRole, usuarioAutenticado } from "../middleware/http_m";

const router = Router();

router.post("/login", loginController);

router.get("/perfil", authenticate, (_req, res) => {
  const usuario = usuarioAutenticado(res);
  return res.json({ usuario: { userId: usuario.id, perfis: usuario.perfis } });
});

router.get("/admin", authenticate, requireRole("ADMIN"), (_req, res) => {
  return res.json({ mensagem: "Acesso autorizado." });
});

export default router;
