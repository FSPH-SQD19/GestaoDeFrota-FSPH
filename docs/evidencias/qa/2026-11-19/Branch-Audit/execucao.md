# Auditoria da branch doc_Qa — 19/11/2026

## Branches e ambiente

- Repositório remoto: `FSPH-SQD19/GestaoDeFrota-FSPH`
- Branch auditada: `doc_Qa`, SHA `aa84e51198d13967ce8b66a86d10917fdfe1c549`; SHA confirmado no GitHub.
- `master` remoto: `168fd8f796a475dc2708398cd351be3525cbd910`.
- Comparação local: as diferenças de `doc_Qa` em relação a `master` nesta rodada são a migração de manutenção, ajustes Nginx/testes QA e evidências; não identifiquei alteração funcional de `master` ausente necessária aos tickets verificados, então não fiz merge.
- Docker Compose: frontend e backend ativos; API publicada em `127.0.0.1:3000`, frontend Nginx em `127.0.0.1:5173`.
- Banco PostgreSQL de desenvolvimento: `prisma migrate status` encontrou 24 migrations e confirmou schema atualizado.
- Ticket S19FROTA-273 e subtarefas 296/297 ficaram fora do escopo conforme solicitado.

## Resultados

| Camada | Execução | Resultado |
| --- | --- | --- |
| Backend unitário | `npm test --workspace=backend` (incluído em `npm test`) | 49 arquivos, 877/877 testes passaram |
| Frontend unitário | `npm test --workspace=frontend` (incluído em `npm test`) | 38 arquivos, 235/235 testes passaram |
| Build e lint | `npm run build`; `npm run lint` | Passaram; Vite emite somente aviso não bloqueante de chunks acima de 500 kB |
| E2E UI desktop e mobile | `npm run test:e2e --workspace=frontend -- --workers=1` | 38/38 passaram; APIs simuladas, não classificar como integração backend |
| E2E Docker integrado | `ROTA_QA_BASE_URL=http://127.0.0.1:5173 npm exec -- playwright test --config playwright.docker.config.ts` | 10/10 passaram: proxy/login, regressão GESTOR/SOLICITANTE, dupla alocação, SVO, API sem sessão, RBAC, isolamento e CSRF |
| Banco/migration | `docker compose exec -T backend npx prisma migrate status` | 24 migrations; schema atualizado; migration `20261118120000_manutencao_status_programada_cancelada` já presente na imagem/backend do ambiente testado |

## Correção da suíte Playwright padrão

Uma primeira execução ampla misturou testes de UI e testes Docker e reutilizou um servidor Node antigo já ligado à porta `4173`. O servidor apontava para a API real em `3000`, de modo que requests não mockados recebiam 401 e encerravam sessões sintéticas. Esses erros eram de isolamento/configuração dos testes e não foram registrados como bugs do produto.

Atualizei `FrontEnd/playwright.config.ts` para:

- excluir `tests/e2e/docker/**` da suíte UI padrão; esses specs continuam exclusivos de `playwright.docker.config.ts`;
- usar porta E2E configurável (`ROTA_QA_E2E_PORT`, padrão 4175) e base URL correspondente;
- não reutilizar outro servidor, a menos que `ROTA_QA_REUSE_SERVER=true` seja solicitado explicitamente.

Após a alteração, a suíte padrão oficial passou 38/38 (19 desktop e 19 mobile) e os 10 specs Docker passaram separadamente nos serviços Docker.

## Situação Jira verificada

- `S19FROTA-274`: Feito.
- `S19FROTA-275` a `S19FROTA-278`: Fazendo; cobertura adicional permanece pendente conforme matriz.
- `S19FROTA-290`: correção de proxy/login passou reteste Docker.
- `S19FROTA-291`: a falha original da constraint foi corrigida; criação 201, cancelamento 200, intervalo invertido 400 e sobreposição 409 passaram em Docker.
- `S19FROTA-292` e subtarefas `293–295`: os critérios de correção, E2E e rebuild passaram.
- `S19FROTA-272`: permanece Fazendo porque há nove cenários pendentes e um cenário externo bloqueado; 24/34 cenários estão aprovados ou parcialmente exercitados.

## Riscos restantes

- MAN-01: reagendamento, conclusão e veículo ocupado ainda não testados de ponta a ponta.
- Segurança e frota: consulta/tentativa por motorista alheio, vazamento sanitário por busca/exportação, documentos vencidos bloqueando alocação e segregação frota SVO/administrativa ainda requerem execução integrada.
- PWA: checklist negativo/odômetro, replay de UUID com troca de usuário, visibilidade GPS e feature flag ativa ainda têm subcasos pendentes.
- `S19FROTA-273` ficou excluído do escopo desta auditoria; o fluxo externo SVO não foi homologado.
- Não foi encontrado novo defeito reproduzível na execução de 19/11. Não recomendar homologação integral até concluir os pendentes de risco alto/crítico.

Nenhuma alteração foi commitada, nenhum merge ou PR foi feito nesta execução.
