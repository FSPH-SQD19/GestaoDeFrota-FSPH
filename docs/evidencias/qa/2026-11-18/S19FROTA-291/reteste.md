# Reteste — S19FROTA-291 / MAN-01

## Ambiente

- Data: 18/11/2026 (America/Cayenne; UTC−04:00)
- Branch: `doc_Qa`; alterações locais ainda não commitadas
- Docker Compose local: frontend Nginx em `127.0.0.1:5173`, backend já em execução e PostgreSQL de desenvolvimento
- Migração `20261118120000_manutencao_status_programada_cancelada` aplicada com `prisma migrate deploy` (24 migrações aplicadas)
- Perfil: GESTOR; veículo e credenciais sintéticos do ambiente de demonstração
- Automação: `FrontEnd/tests/e2e/docker/regressao.spec.ts`

## Alteração sob teste

A constraint `manutencoes_status_check` permitia apenas `ABERTA` e `CONCLUIDA`, apesar do serviço gravar `PROGRAMADA` ao agendar e `CANCELADA` ao cancelar. A nova migração substitui a constraint por uma lista que aceita os quatro estados usados pelo serviço. A migração é aditiva e não reescreve as migrações históricas.

## Passos reproduzíveis

1. Aplicar as migrações do backend ao banco local: `docker compose exec -T backend npx prisma migrate deploy`.
2. Definir `ROTA_QA_BASE_URL=http://127.0.0.1:5173`.
3. Na pasta `FrontEnd`, executar `npm exec -- playwright test --config playwright.docker.config.ts tests/e2e/docker/regressao.spec.ts --grep "GESTOR integra frota"`.
4. Autenticar como GESTOR sintético; abrir Veículos; programar manutenção preventiva para DMO2A02 numa janela futura sem conflito; confirmar e cancelar a programação.

## Resultado

| Verificação | Esperado | Obtido |
| --- | --- | --- |
| Criar programação preventiva | `POST /api/v1/manutencoes/programacoes` retorna 201 | Passou; a programação foi criada e a interface confirmou o sucesso |
| Intervalo invertido | Enviar início posterior ao fim | HTTP 400, sem persistência |
| Janela já programada | Criar uma programação sobrepondo a fixture ativa | HTTP 409, sem segunda programação |
| Cancelar a programação | `PATCH /api/v1/manutencoes/{id}/cancelar` retorna 200 e libera a janela | Passou; a interface confirmou o cancelamento |
| Regressão integrada adjacente | Solicitações, notificações e três agregados de relatório continuam acessíveis | Passou no mesmo fluxo E2E |
| Playwright | Teste GESTOR sem falhas | **1/1 passou**; fluxo testado em 7,0 s |

**Atualização de 19/11/2026:** o usuário refez o build Docker. As novas imagens foram verificadas e os containers frontend/backend recriados; a migração consta na imagem backend e `prisma migrate status` confirmou 24 migrações com schema em dia. O reteste E2E da manutenção passou nos containers novos, incluindo criação (201), cancelamento (200), intervalo invertido (400) e sobreposição (409). Evidência consolidada: [reteste após rebuild](../../2026-11-19/Docker-Rebuild/execucao.md). A observação anterior sobre `npm ci` descreve apenas a tentativa de build de 18/11 e está superada. Nesta revisão posterior, `docker compose ps` não conseguiu consultar o daemon pela pipe do Docker Desktop (acesso negado); os resultados registrados correspondem à execução concluída após recriar os containers. Não foram registrados credenciais, cookies ou tokens. Reagendamento, conclusão e veículo ocupado continuam pendentes em MAN-01.
