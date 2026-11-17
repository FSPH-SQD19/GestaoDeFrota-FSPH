# Evidências — segurança RBAC/autenticação (task 3)

## Ambiente e execução

- Data: 17/11/2026 (America/Cayenne; UTC−04:00)
- Branch/commit de base: `doc_Qa` / `0eb6212`; alteração desta task ainda não commitada
- Serviços: Docker local; API em `127.0.0.1:3000`, interface Vite de QA em `127.0.0.1:4173`
- Banco: desenvolvimento local; somente contas/dados sintéticos
- Automação: `FrontEnd/tests/e2e/docker/seguranca.spec.ts`
- Execução final consolidada: 3 testes aprovados em 17/11/2026, após o cooldown da conta sintética.

## Resultados reproduzidos

| Cenário | Execução | Resultado |
| --- | --- | --- |
| Autenticação sem sessão | GET em sete rotas protegidas (`/auth/sessao`, veículos, solicitações, manutenção, notificações, relatório e SVO). | Todas 401. |
| Token inválido | GET `/api/v1/auth/sessao` com `Authorization: Bearer token-invalido`. | 401. |
| Matriz RBAC por perfil | GESTOR/ADMIN, SOLICITANTE, MOTORISTA e SVO consultam rotas de frota, viagens, manutenção, relatórios e SVO; notificações consultadas nos cinco perfis. | Status esperados confirmados: rotas restritas 403, rotas permitidas 200. Sem 5xx. |
| Isolamento de lista | SOLICITANTE consulta `/api/v1/solicitacoes`; cada registro retornado tem `solicitanteId` igual ao ID da sessão. | Passou com registros sintéticos existentes. |
| IDOR de cancelamento | ADMIN cria solicitação sintética própria; SOLICITANTE não a vê na lista e tenta cancelar com CSRF válido. ADMIN cancela a fixture ao final. | Consulta não revela o ID; tentativa de cancelamento retorna 403; limpeza retorna 200. |
| CSRF e origem | SOLICITANTE autenticado tenta POST sem CSRF; GET de CSRF envia `Origin: https://atacante.example`. | Ambos retornam 403. |

A execução integral anterior da especificação mostrou 5 testes aprovados. Uma repetição posterior atingiu o limite real de login do ambiente (`Muitas tentativas. Tente novamente em 15 minutos.`), com limite de 10 tentativas por conta e janela de 15 minutos. As execuções repetidas de QA consumiram essa cota; não foi declarado defeito do produto nem removido o limitador do banco. Consolidei cenários que usavam SOLICITANTE para reduzir logins; após o cooldown, a versão consolidada passou integralmente: **3 testes aprovados**. `test:types`, lint e `git diff --check` também passaram.

## Escopo ainda pendente

- AUT-02: credencial inválida e resposta de limitação em ambiente controlado. Não forcei novas tentativas nem limpei o limitador de login do banco.
- AUT-03: replay após logout e sessão expirada; o teste negativo de CSRF passou, mas não retestei revogação nesta rodada.
- RBAC-01: CRUD de usuários, auditoria e ausência de senha/hash em logs.
- RBAC-03: IDOR entre motoristas em viagem/ordem atribuída; a matriz cobriu negação de rotas administrativas, não tentativa contra uma atribuição alheia.
- RBAC-04: conteúdo sanitário, exportação, busca e localização; foi verificada a barreira de entrada do endpoint de chamados, sem inspecionar dados sanitários.
- Concorrência/dupla alocação e falhas/timeout da API permanecem para suas tarefas/cenários dedicados.

Não foi identificado bug nesta rodada de segurança; respostas 401/403 e restrição da listagem corresponderam ao esperado. Os achados Docker de login e manutenção continuam registrados em E2E-02 e seguem sem deduplicação Jira porque o projeto está inacessível nesta sessão.
