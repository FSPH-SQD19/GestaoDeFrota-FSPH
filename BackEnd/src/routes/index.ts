import { Router } from "express";
import veiculos from "./veiculo_r";
import dashboardRoutes from "./dashboard_r";
import relatorioRoutes from "./relatorio_r";
import {
  listarAbastecimentosController,
  criarAbastecimentoController,
  listarMeusAbastecimentosController,
} from "../controller/abastecimento_c";
import { healthController } from "../controller/health_c";
import { authenticate, requireRole } from "../middleware/http_m";
import authRoutes from "./auth_r";
import motoristaRoutes from "./motorista_r";
import {
  concluirManutencaoController,
  criarManutencaoController,
  listarManutencoesController,
} from "../controller/manutencao_c";
import solicitacaoRoutes from "./solicitacao_r";
import notificacaoRoutes from "./notificacao_r";
import multaRoutes from "./multa_r";
import {
  criarEscalaSvoController,
  encerrarEscalaSvoController,
  listarEscalasSvoController,
} from "../controller/escala_svo_c";

const router = Router();
const abastecimento = Router();
const manutencoes = Router();
const escalasSvo = Router();

router.get("/health", healthController);
router.use("/auth", authRoutes);
router.use("/motoristas", motoristaRoutes);

router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/veiculos", veiculos);
router.use("/api/v1/dashboard", dashboardRoutes);
router.use("/solicitacoes", solicitacaoRoutes);

// Consultar abastecimento
abastecimento.use(authenticate);
abastecimento.get("/meus", requireRole("MOTORISTA"), listarMeusAbastecimentosController);
abastecimento.get("/", requireRole("ADMIN", "GESTOR"), listarAbastecimentosController);
abastecimento.post("/", requireRole("ADMIN", "GESTOR", "MOTORISTA"), criarAbastecimentoController);

router.use("/api/v1/abastecimentos", abastecimento);

router.use("/api/v1/solicitacoes", solicitacaoRoutes);

router.use("/api/v1/relatorios", relatorioRoutes);
//Registro de manutencoes
manutencoes.use(authenticate, requireRole("ADMIN", "GESTOR"));
manutencoes.get("/", listarManutencoesController);
manutencoes.post("/", criarManutencaoController);
manutencoes.patch("/:id/concluir", concluirManutencaoController);

router.use("/api/v1/manutencoes", manutencoes);

// Escalas e plantoes do SVO
escalasSvo.use(authenticate, requireRole("ADMIN", "GESTOR", "SVO"));
escalasSvo.get("/", listarEscalasSvoController);
escalasSvo.post("/", criarEscalaSvoController);
escalasSvo.patch("/:id/encerrar", encerrarEscalaSvoController);

router.use("/api/v1/svo/escalas", escalasSvo);

router.use("/notificacoes", notificacaoRoutes);
router.use("/api/v1/notificacoes", notificacaoRoutes);
router.use("/multas", multaRoutes);
router.use("/api/v1/multas", multaRoutes);

export default router;
