# Regressão E2E Docker — 18/11/2026

## Ambiente

- Branch: `doc_Qa`; alterações locais não commitadas
- Frontend Nginx: `http://127.0.0.1:5173`
- Backend: API local publicada em `127.0.0.1:3000`; PostgreSQL de desenvolvimento
- Dados e contas: sintéticos do ambiente local
- Automação: `FrontEnd/playwright.docker.config.ts` e `FrontEnd/tests/e2e/docker/`

## Execução

Na pasta `FrontEnd`, definir `ROTA_QA_BASE_URL=http://127.0.0.1:5173` e executar:

```powershell
npm exec -- playwright test --config playwright.docker.config.ts
```

Resultado final: **10/10 testes passaram em 38,1 s**, em um worker:

- concorrência de alocação ADMIN: 1/1; uma aprovação 200 e uma rejeição por conflito 409;
- proxy Nginx, sessão/CSRF/login: 1/1;
- regressão GESTOR (frota, manutenção, notificações e relatórios): passou;
- solicitação e cancelamento sintéticos SOLICITANTE: passou;
- autenticação sem sessão, RBAC dos cinco perfis e isolamento/CSRF: 3/3;
- SVO: telefonema sintético, capacidade concorrente, despacho, etapas e bloqueio sanitário: 3/3.

## Ajustes de automação nesta rodada

- A configuração Docker aceita `ROTA_QA_BASE_URL`, permitindo executar contra o frontend Nginx publicado sem iniciar Vite.
- O helper de segurança usa essa mesma URL configurável; antes, criava sessões em `127.0.0.1:4173` mesmo quando o teste apontava ao container Docker.
- A fixture de concorrência consulta documentos do veículo e só usa candidato válido até o retorno. O veículo anteriormente selecionado tinha documento vencendo antes da viagem e gerava 422 para as duas aprovações, antes da disputa por recursos.

Falhas iniciais da automação foram reproduzidas e atribuídas a configuração/seleção das fixtures, corrigidas nos testes e reexecutadas. Não foram registradas como Bugs do produto. Depois de várias execuções da suíte em sequência, uma tentativa adicional recebeu 429 no login: o limitador compartilhado bloqueia o IP após 30 tentativas em 15 minutos. Essa tentativa não substitui o resultado limpo de 10/10; a nova asserção de MAN-01 (inversão 400 e sobreposição 409) também passou isoladamente. Para repetir a suíte completa após atingir o limite, aguardar o prazo do Retry-After. A suíte cobre os cenários automatizados listados acima; não substitui os cenários manuais ainda pendentes da matriz.

## Verificações adicionais

- Testes backend direcionados de manutenção: 3 arquivos, **55/55 passaram** (rotas de manutenção, rotas de programação preventiva e serviço de programação).
- Suíte unitária backend completa: **49 arquivos, 877/877 passaram**.
- Suíte unitária frontend completa: **38 arquivos, 235/235 passaram** com um worker. Duas páginas haviam estourado o timeout de 5 s ao rodar em paralelo; os dois arquivos passaram isoladamente e a suíte inteira passou na execução serial.
- `npm run build` e `npm run lint` passaram no frontend e no backend local.
- `git diff --check` passou.
- `docker compose build backend` continua sem concluir: `npm ci` encerra com erro interno `Exit handler never called!`. O container backend em execução foi usado para o E2E, com as 24 migrações aplicadas; por isso, a imagem reconstruída ainda precisa ser validada após corrigir o build do npm.
