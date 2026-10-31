import { Router } from "express";
import { revokeSession } from "../service/session_s";
import { issueCsrf, cookieOptions, sessionCookieName } from "../middleware/session_http";
import { limitLogin } from "../middleware/login_limit";
import { loginController } from "../controller/auth_c";
import { authenticate, requireRole, usuarioAutenticado } from "../middleware/http_m";

const router = Router();

router.get("/csrf", issueCsrf);
router.post("/login", limitLogin, loginController);
router.post("/logout", authenticate, async (_req, res) => {
  await revokeSession(usuarioAutenticado(res).sessaoId!);
  res.clearCookie(sessionCookieName(), cookieOptions());
  return res.sendStatus(204);
});
router.get("/sessao", authenticate, (_req, res) => {
  const usuario = usuarioAutenticado(res);
  return res.json({
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: usuario.perfis },
  });
});

router.get("/perfil", authenticate, (_req, res) => {
  const usuario = usuarioAutenticado(res);
  return res.json({ usuario: { userId: usuario.id, perfis: usuario.perfis } });
});

router.get("/admin", authenticate, requireRole("ADMIN"), (_req, res) => {
  return res.json({ mensagem: "Acesso autorizado." });
});

export default router;
