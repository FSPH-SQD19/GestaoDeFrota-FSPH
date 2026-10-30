import { gerarRelatorio, periodoRelatorioSchema } from "../service/relatorio_s";
import { validar } from "../controller/veiculo_c";
import { Router } from "express";
import { criarVeiculoController, listarVeiculosController } from "../controller/veiculo_c";
import {
  listarAbastecimentosController,
  criarAbastecimentoController,
} from "../controller/abastecimento_c";
import { healthController } from "../controller/health_c";
import { authenticate, requireRole } from "../middleware/http_m";
import authRoutes from "./auth_r";
import motoristaRoutes from "./motorista_r";
import solicitacaoRoutes from "./solicitacao_r";

const router = Router();
const veiculos = Router();
const abastecimento = Router();

// Consultar carrinhos (VrumVrum)
veiculos.use(authenticate, requireRole("ADMIN", "GESTOR"));
veiculos.get("/", listarVeiculosController);
veiculos.post("/", criarVeiculoController);

router.get("/health", healthController);
router.use("/auth", authRoutes);
router.use("/motoristas", motoristaRoutes);

router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/veiculos", veiculos);
router.use("/solicitacoes", solicitacaoRoutes);

// Consultar abastecimento
abastecimento.use(authenticate, requireRole("ADMIN", "GESTOR"));
abastecimento.get("/", listarAbastecimentosController);
abastecimento.post("/", criarAbastecimentoController);

router.use("/api/v1/abastecimentos", abastecimento);

router.use("/api/v1/solicitacoes", solicitacaoRoutes);

router.get("/api/v1/relatorios", authenticate, requireRole("ADMIN", "GESTOR"), async (req, res) => {
  const periodo = validar(periodoRelatorioSchema, req.query);
  return res.json(await gerarRelatorio(periodo));
});

export default router;
