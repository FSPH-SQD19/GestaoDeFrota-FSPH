import { Router } from "express";
import { listarMotoristasTeste } from "../controller/motoristaTeste_c";

const router = Router();

router.get("/motoristas", listarMotoristasTeste);

export default router;