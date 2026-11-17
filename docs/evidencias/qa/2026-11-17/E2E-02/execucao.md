# Evidências — regressão E2E integrada (task 2)

## Ambiente

- Data: 17/11/2026 (America/Cayenne; UTC−04:00)
- Branch/commit testado: `doc_Qa` / `3898194` (após merge de `master`)
- Aplicação: Docker local; API em `127.0.0.1:3000`; frontend Vite de QA em `127.0.0.1:4173`
- Banco: PostgreSQL local de desenvolvimento, migrations pendentes aplicadas e dados sintéticos do seed demo
- Perfis usados: GESTOR e SOLICITANTE. Credenciais e dados pessoais foram omitidos.
- Automação: `FrontEnd/playwright.docker.config.ts` e `FrontEnd/tests/e2e/docker/regressao.spec.ts`

## Execuções

| Cenário | Passos reproduzíveis | Esperado | Obtido | Resultado |
| --- | --- | --- | --- | --- |
| AUT-01 (parcial) | Com sessão encerrada, carregar rotas protegidas da API e depois entrar pelo formulário da aplicação. | Rotas sem sessão recusam acesso; login válido abre o sistema. | Rotas protegidas retornaram 401; `GET /api/v1/auth/csrf` e `POST /api/v1/auth/login` retornaram 200. | PASSOU (escopo limitado) |
| AUT-01 / API-01 (Docker empacotado) | Abrir o frontend publicado pelo serviço Docker em `127.0.0.1:5173`; observar as requisições do formulário de login. | Frontend encaminha `/api/v1/auth/*` ao backend e aceita login válido. | `GET /api/v1/auth/sessao` e `/csrf` retornaram 200 `text/html` do fallback SPA; `POST /api/v1/auth/login` retornou 405 `text/html`. O login não autentica no frontend empacotado. | FALHOU reproduzível — bloqueio de login no Docker |
| VIA-01 (parcial) | Entrar como SOLICITANTE; criar solicitação sintética com setor LACEN, origem/destino fictícios e horários futuros; confirmar e cancelar pela interface. | POST cria protocolo; cancelamento permitido registra motivo e retorna sucesso. | `POST /api/v1/solicitacoes` 201; `PATCH /api/v1/solicitacoes/{id}/cancelar` 200; teste Playwright passou. | PASSOU (negativos pendentes) |
| FRO-01 (leitura) | Entrar como GESTOR; abrir Veículos e verificar o veículo sintético DMO2A02. | Listagem integrada responde e apresenta dados de frota. | Tela carregou e a API `GET /api/v1/veiculos` respondeu 200. | PASSOU (cadastro/validações pendentes) |
| MAN-01 | Entrar como GESTOR; abrir Veículos → programação preventiva de DMO2A02; selecionar início e fim futuros sem conflito; confirmar programação. | `POST /api/v1/manutencoes/programacoes` retorna 201 e cria programação. | Reproduzido duas vezes: resposta 500. Log do backend: `new row for relation "manutencoes" violates check constraint "manutencoes_status_check"`; SQLSTATE `23514`. A migration `20261030131217_manutencao_status_conclusao` limita a constraint a `ABERTA` e `CONCLUIDA`; a rotina preventiva grava `PROGRAMADA`. | FALHOU — bug reproduzido, Jira ainda não deduplicado |
| VIA-01 / NOT-01 / REL-01 (parcial) | No fluxo do GESTOR, após a tentativa de manutenção, abrir Solicitações, Central de notificações e abas Consumo médio, Manutenções e Viagens por setor. | Leitura integrada retorna sucesso e renderiza os módulos. | Solicitações 200; notificações 200; agregados de consumo, manutenção e viagens 200. Fluxo continuou após a falha MAN-01. | PASSOU (sem alterações de estado; negativos pendentes) |
| RBAC exploratório (parcial) | Enviar GET sem sessão e com sessão de cada papel para endpoints de veículos, solicitações, manutenção, notificações, relatórios, SVO, avarias, sedes e configuração do motorista. | API responde 401 sem sessão e aplica autorização por papel sem retornar 5xx. | Sem sessão: 401 nas rotas protegidas. Com sessão: ADMIN acessou endpoints administrativos; GESTOR teve 403 em SVO; SOLICITANTE teve 403 em frota, manutenção, relatórios, SVO, avarias e sedes; MOTORISTA teve 200 em `/solicitacoes/minhas` e 403 em rotas administrativas; SVO teve 200 em `/svo/chamados` e 403 em endpoints administrativos. | PASSOU (checagem de leitura; IDOR/mutação ainda pendentes) |

## Evidência da falha MAN-01

```text
UI: programação preventiva → Confirmar programação
Request: POST /api/v1/manutencoes/programacoes
Expected: 201 Created
Actual: 500 Internal Server Error
Database: SQLSTATE 23514 — check constraint "manutencoes_status_check"
Constraint versionada: status IN ('ABERTA', 'CONCLUIDA')
Status solicitado pela rotina preventiva: PROGRAMADA
Dados usados: exclusivamente seed sintético local; valores de linha omitidos.
```

O caso está reproduzido pela interface e pela resposta integrada da API; não foi inferido apenas pela leitura do código. A API falha antes da criação da programação. A tela não conclui a operação. A constraint incompatível explica o 500 no banco local migrado pelo repositório.

## Evidência da falha AUT-01 / API-01 no frontend Docker

```text
Frontend Docker: http://127.0.0.1:5173
GET /api/v1/auth/sessao → 200 text/html (fallback SPA)
GET /api/v1/auth/csrf   → 200 text/html (fallback SPA)
POST /api/v1/auth/login → 405 text/html
Resultado visível: login não sai da tela de autenticação.
```

O frontend de QA servido pelo Vite em `127.0.0.1:4173`, configurado para apontar ao backend `127.0.0.1:3000`, autenticou e executou os E2E. O frontend do serviço Docker foi verificado separadamente e reproduziu a falha de roteamento acima. São origens/configurações distintas; não confundir o sucesso do fluxo Vite com o login do pacote Docker.

## Limites desta rodada

- Nenhum ticket foi criado para AUT-01/API-01 e MAN-01: o Jira do projeto retornou inacessível nesta sessão e não há conector Jira disponível. Antes de abrir, ainda é necessário pesquisar duplicatas pelo resumo, módulo e assinatura da falha.
- Não executados nesta rodada: perfis ADMIN/MOTORISTA/SVO em interface, corrida de dupla alocação, adulteração de IDs/IDOR, payloads sanitários, falhas/timeout de API, documentos, fluxo SVO telefônico, capacidade/despacho, PWA/offline, avarias, sedes e solicitação externa.
- Testes de mutação foram limitados a criação/cancelamento de solicitação sintética e tentativa de programação preventiva. O banco foi local de desenvolvimento, não homologação.
- Não foi possível anexar captura nesta evidência; o resultado é sustentado pelo teste Playwright, status HTTP e log sanitizado acima. Os artefatos temporários de falha do Playwright contêm estado de formulário e não devem ser anexados sem sanitização.
