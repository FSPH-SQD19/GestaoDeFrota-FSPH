# ROTA — Gestão de Frota e SVO (FSPH)

Projeto do **Squad 19**, desenvolvido para a **Fundação de Saúde Parreiras Horta (FSPH)** no programa **Takeoff — Residência em Software e IA** (Porto Digital & Unit).

A documentação completa está organizada em [`docs/README.md`](docs/README.md), com guias de execução, arquitetura, testes, segurança, CI/CD e governança de Inteligência Artificial.

---

## 🏆 Índice Rápido — Entrega Final Takeoff (Critérios 1.1 a 1.5)

Para facilitar a avaliação da banca examinadora, todos os entregáveis técnicos exigidos na rubrica da **Entrega Final** estão indexados abaixo:

| Item da Rubrica | Entregável / Documento | Descrição |
| :--- | :--- | :--- |
| **1.1 Código-Fonte e Solução** | [`BackEnd/`](BackEnd/) · [`FrontEnd/`](FrontEnd/) · [`docs/PROJETO.md`](docs/PROJETO.md) | Código-fonte completo do MVP (Frota Administrativa, Logística SVO, PWA do Motorista com OSRM/PostGIS e Trilha de Auditoria LGPD). |
| **1.2 Integrações de IA e Engenharia de Prompt** | [`docs/IA_E_ENGENHARIA_DE_PROMPT.md`](docs/IA_E_ENGENHARIA_DE_PROMPT.md) | Ferramentas de IA utilizadas na engenharia, arquitetura de *Guardrails Determinísticos*, análise de custo por chamada/token (2.2) e limites/qualidade (2.3). |
| **1.3 Guia de Implantação e Variáveis de Ambiente** | Seção [Implantação e Ambiente](#-guia-de-implantação-e-variáveis-de-ambiente-critério-13) e [`docs/AMBIENTE.md`](docs/AMBIENTE.md) | Passo a passo para recriar o ambiente local, Docker e HML, configuração de variáveis `.env`, chaves e serviços geoespaciais/IA. |
| **1.4 Repositório de Prompts com Rastreabilidade** | [`prompts/README.md`](prompts/README.md) (`PRM-01` a `PRM-05`) | Acervo versionado de prompts (`v1.0` → `v4.0`) com histórico de modificações auditável via `git log -p -- prompts/`. |
| **1.5 Exemplos de Prompts que Falharam (1 pág.)** | [`docs/PROMPTS_QUE_FALHARAM.md`](docs/PROMPTS_QUE_FALHARAM.md) | Relatório executivo (1 página) com casos reais de prompts que falharam, análise de causa raiz, ajustes de prompt e validação via testes. |

---

## 🚀 Guia de Implantação e Variáveis de Ambiente (Critério 1.3)

### 1. Pré-requisitos
- **Node.js** `^22.12.0 || ^24.0.0 || >=26.0.0` e **npm**
- **PostgreSQL 16+ com extensão PostGIS** (Neon Serverless ou container local)
- **Docker & Docker Compose** (opcional, para execução em contêineres e serviço de rotas OSRM)

### 2. Configuração de Variáveis de Ambiente e Chaves (`.env`)

Crie os arquivos locais a partir dos modelos versionados:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path BackEnd/.env)) { Copy-Item BackEnd/.env.example BackEnd/.env }
if (!(Test-Path FrontEnd/.env)) { Copy-Item FrontEnd/.env.example FrontEnd/.env }
```

Principais variáveis de ambiente (`BackEnd/.env` e `FrontEnd/.env`):

| Variável | Onde Configurar | Finalidade |
| :--- | :--- | :--- |
| `DATABASE_URL` | `BackEnd/.env` | Connection string PostgreSQL + PostGIS (Neon ou local). |
| `DIRECT_URL` | `BackEnd/.env` | Conexão direta sem pooler para execução de migrations Prisma. |
| `PORT` | `BackEnd/.env` | Porta HTTP da API REST (padrão: `3000`). |
| `JWT_SECRET` | `BackEnd/.env` | Segredo criptográfico (128 hex chars em produção; gerado automaticamente em `BackEnd/.runtime/auth.key` no dev). |
| `APP_ORIGINS` | `BackEnd/.env` | Origens CORS autorizadas (padrão dev: `http://localhost:5173,http://localhost:4173`). |
| `DIARIO_ENABLED` / `OSRM_URL` | `BackEnd/.env` | Habilita o módulo PWA de Diário de Bordo e define o endpoint do motor de rotas OSRM. |
| `VITE_API_URL` | `FrontEnd/.env` | URL base da API consumida pelo Front-End (padrão: `http://localhost:3000`). |
| `AI_PROVIDER_API_KEY` *(Opcional)* | Ambiente Dev / CI | O core operacional do ROTA em produção é **100% determinístico** (não exige chave de LLM externa em runtime para funcionar 24/7). Caso um módulo consultivo de IA seja conectado em homologação, a chave deve ser injetada exclusivamente via variável de ambiente não versionada. |

### 3. Execução Rápida (Desenvolvimento Local)

```bash
npm ci
npm exec --workspace=backend -- prisma migrate deploy
npm run seed:demo --workspace=backend
npm run dev
```

- **Interface Web & PWA:** `http://localhost:5173`
- **Healthcheck da API:** `http://localhost:3000/health`
- **Credenciais de Demonstração:** Geradas automaticamente em `BackEnd/.runtime/demo-access.json` ao rodar `seed:demo` (perfis `admin`, `gestor`, `motorista`, `svo`, `solicitante`).

### 4. Execução via Docker Compose

```bash
docker compose up --build -d
docker compose exec backend npx prisma migrate deploy
```

### 5. Verificação de Qualidade, Linter e Testes Automatizados

```bash
npm run lint
npm test
```

Consulte [`docs/INICIO.md`](docs/INICIO.md) para todos os comandos npm, [`docs/AMBIENTE.md`](docs/AMBIENTE.md) para detalhes de infraestrutura/HML e [`docs/TESTES.md`](docs/TESTES.md) + [`docs/MATRIZ_QA_EXPLORATORIA.md`](docs/MATRIZ_QA_EXPLORATORIA.md) para a suíte de testes unitários e regressão E2E.

---

## Sobre o Projeto

O **ROTA** unifica a gestão da frota administrativa e a regulação/logística do Serviço de Verificação de Óbito (SVO) da FSPH. O contexto completo, escopo funcional, regras de negócio, equipe e licença estão detalhados em [`docs/PROJETO.md`](docs/PROJETO.md).
