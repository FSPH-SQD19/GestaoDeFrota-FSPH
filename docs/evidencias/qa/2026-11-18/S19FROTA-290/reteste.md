# Reteste — S19FROTA-290

## Ambiente

- Data: 18/11/2026 (America/Cayenne; UTC−04:00)
- Branch: `doc_Qa`
- Base versionada: `16c06db`; correção executada no working tree ainda não commitado
- Docker Compose local: backend mantido em execução; frontend reconstruído e recriado
- Frontend publicado: `http://127.0.0.1:5173`
- API acessada pelo proxy Nginx do frontend, com dados de demonstração sintéticos
- Automação: `FrontEnd/tests/e2e/docker/nginx-proxy.spec.ts`

## Passos reproduzíveis

1. Aplicar a configuração de proxy `/api/` do `FrontEnd/nginx.conf`.
2. Executar `docker compose build frontend`.
3. Executar `docker compose up -d --no-deps frontend`.
4. Rodar `npm exec -- playwright test --config playwright.docker.config.ts tests/e2e/docker/nginx-proxy.spec.ts`.
5. O teste abre o frontend na porta 5173, consulta a sessão e CSRF, autentica com uma conta GESTOR sintética e acessa uma rota SPA desconhecida.

## Resultado

| Verificação | Esperado | Obtido |
| --- | --- | --- |
| GET `/api/v1/auth/sessao` sem autenticação | Resposta JSON `401` da API | JSON `401`; não retorna HTML do SPA |
| GET `/api/v1/auth/csrf` | Resposta JSON `200` da API | JSON `200` |
| POST `/api/v1/auth/login` | Resposta JSON `200` e autenticação | JSON `200`; menu da conta ficou visível |
| GET de rota SPA desconhecida | `200 text/html` do fallback frontend | `200 text/html` |
| E2E no frontend Docker real | Passar | **1/1 passou** |

Credenciais, cookies e token CSRF foram usados pelo teste, sem serem registrados na evidência. A correção cobre o login no pacote Docker; os outros bugs QA permanecem independentes.
