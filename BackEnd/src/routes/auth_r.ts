import { Router } from "express";
import { loginController } from "../controller/auth_c";

const router = Router();

router.post("/login", loginController);

export default router