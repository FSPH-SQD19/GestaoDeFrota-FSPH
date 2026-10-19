import { Router } from "express";
import { loginController } from "../controller/auth_c";
import { AuthToken } from "../middleware/auth_m";
import { Request, Response, NextFunction } from "express";
import { autorizarPerfis } from "../middleware/RBAC_m";

const router = Router();

router.post("/login", loginController);

router.get("/perfil", AuthToken, (req: Request, res: Response) => {
  return res.json({usuario: res.locals.auth,});
});

router.get( "/admin",AuthToken,autorizarPerfis("ADMIN"),(req: Request, res: Response) => {
    return res.json({ mensagem: "Acesso autorizado." });
  }
);


export default router