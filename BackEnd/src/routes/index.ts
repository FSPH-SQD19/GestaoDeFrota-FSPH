import diarioRoutes from "./diario_r";
import { gerarRelatorio, periodoRelatorioSchema } from "../service/relatorio_s";
import { validar } from "../lib/validar";
import { Router } from "express";
import veiculos from "./veiculo_r";
import dashboardRoutes from "./dashboard_r";
import {
  listarAbastecimentosController,
  criarAbastecimentoController,
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
import {
  criarEscalaSvoController,
  encerrarEscalaSvoController,
  listarEscalasSvoController,
} from "../controller/escala_svo_c";

const router = Router();
router.use("/api/v1", diarioRoutes);
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
abastecimento.use(authenticate, requireRole("ADMIN", "GESTOR"));
abastecimento.get("/", listarAbastecimentosController);
abastecimento.post("/", criarAbastecimentoController);

router.use("/api/v1/abastecimentos", abastecimento);

router.use("/api/v1/solicitacoes", solicitacaoRoutes);

router.get("/api/v1/relatorios", authenticate, requireRole("ADMIN", "GESTOR"), async (req, res) => {
  const periodo = validar(periodoRelatorioSchema, req.query);
  return res.json(await gerarRelatorio(periodo));
});
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

export default router;
