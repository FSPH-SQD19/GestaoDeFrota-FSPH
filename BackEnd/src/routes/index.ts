import { gerarRelatorio, periodoRelatorioSchema } from "../service/relatorio_s";
import { validar } from "../controller/veiculo_c";
import { Router } from "express";
import { criarVeiculoController, listarVeiculosController } from "../controller/veiculo_c";
import {
  listarAbastecimentosController,
  criarAbastecimentoController,
} from "../controller/abastecimento_c";
import {
  criarSolicitacaoController,
  listarSolicitacoesController,
} from "../controller/solicitacao_c";
import { healthController } from "../controller/health_c";
import { authenticate, requireRole } from "../middleware/http_m";
import authRoutes from "./auth_r";
import motoristaRoutes from "./motorista_r";
import {
  concluirManutencaoController,
  criarManutencaoController,
  listarManutencoesController,
} from "../controller/manutencao_c";

const router = Router();
const veiculos = Router();
const abastecimento = Router();
const solicitacoes = Router();
const manutencoes = Router();

// Consultar carrinhos (VrumVrum)
veiculos.use(authenticate, requireRole("ADMIN", "GESTOR"));
veiculos.get("/", listarVeiculosController);
veiculos.post("/", criarVeiculoController);

router.get("/health", healthController);
router.use("/auth", authRoutes);
router.use("/motoristas", motoristaRoutes);

router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/veiculos", veiculos);

// Consultar abastecimento
abastecimento.use(authenticate, requireRole("ADMIN", "GESTOR"));
abastecimento.get("/", listarAbastecimentosController);
abastecimento.post("/", criarAbastecimentoController);

router.use("/api/v1/abastecimentos", abastecimento);

// Solicitacoes de viagens
solicitacoes.use(authenticate, requireRole("SOLICITANTE", "GESTOR", "ADMIN"));
solicitacoes.get("/", listarSolicitacoesController);
solicitacoes.post("/", criarSolicitacaoController);

router.use("/api/v1/solicitacoes", solicitacoes);

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

export default router;
