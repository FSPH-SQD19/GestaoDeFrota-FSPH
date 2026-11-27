# Prompts — Qualidade, Testes, Segurança e Regressão E2E (PRM-03)

Este documento registra os prompts utilizados para geração e refatoração de suítes de testes automatizados (**Vitest**, **React Testing Library**, **Playwright E2E**), blindagem de segurança (**Sessões HttpOnly, CSRF, Rate Limiting e RBAC**) e adequação estrita ao **Oxlint** (`oxlint --deny-warnings`).

---

## 1. Prompt de Geração de Testes Unitários para Services do Prisma com Mock Isolado

### Versão: `v2.2` -> `v3.0`

#### Contexto e Desafio:

Garantir que os testes de serviço e rotas no BackEnd (mais de 870 testes unitários) rodem de forma determinística e rápida no CI (`npm test`), simulando transações e queries do Prisma Client com `vi.hoisted` e `vi.mock`.

#### Prompt Utilizado:

```markdown
Atue como Engenheiro de QA e Especialista em Testes Automatizados com Vitest e TypeScript.
Você deve gerar a suíte de testes unitários para o módulo `{nome_do_modulo}`.

REQUISITOS OBRIGATÓRIOS DE QUALIDADE:

1. Mock completo do Prisma Client usando `vi.hoisted` e `vi.mock("../../../src/lib/prisma", () => ({ prisma: { ... } }))`.
2. Testar todos os ramos:
   - Caminho feliz (happy path) e persistência esperada.
   - Validações Zod (400), falta de autenticação (401), violação de perfil RBAC (403), recurso inexistente (404) e conflitos de estado/concorrência (409).
3. Resetar os mocks antes de cada teste com `beforeEach(() => { vi.clearAllMocks(); })`.
4. Não utilizar 'any' para simular retornos; mantenha 100% de compatibilidade com `tsc -p tsconfig.test.json`.
5. Não deixe variáveis ou imports não utilizados (política zero warnings no `oxlint --deny-warnings`).
```

---

## 2. Prompt de Testes de Componentes React (Hooks, Modais e Eventos de UI)

### Versão: `v2.0` -> `v3.0`

#### Prompt Utilizado:

```markdown
Gere a suíte de testes unitários com Vitest e `@testing-library/react` para a página/modal `{NomeDoComponente}.tsx`.

DIRETRIZES:

1. Use `render`, `screen`, `within` e `userEvent.setup()` para simular interações reais do usuário.
2. Mock de módulos de API (`apiRequest` ou services dedicados) usando `vi.mock(...)`.
3. Teste obrigatoriamente:
   - Renderização inicial, filtros combinados e paginação voltando à página 1.
   - Preservação dos dados preenchidos no formulário quando a API rejeita a submissão (ex.: erro 409 ou 500).
   - Bloqueio de duplo envio e fechamento acidental enquanto a requisição estiver pendente.
   - Estados de erro acessíveis (`role="alert"`) com opção de nova tentativa (retry).
```

---

## 3. Prompt de Blindagem de Autenticação, Sessão HttpOnly, CSRF e Rate Limiting

### Versão: `v3.5` (Sprints 7 a 11)

#### Contexto de Segurança:

Migração de tokens expostos no `localStorage` para sessões revogáveis no banco (`auth_sessoes`) com cookies `HttpOnly`, proteção CSRF double-submit e rate limiting compartilhado no PostgreSQL (`auth_login_limites`).

#### Prompt Utilizado:

```markdown
Refine a arquitetura de autenticação e segurança HTTP do BackEnd (`session_http.ts`, `login_limit.ts`, `http_m.ts`, `senha_s.ts`):

1. Sessão e Cookies:
   - Emitir JWT apenas em cookie `HttpOnly`, `SameSite=Lax` (e `Secure` com prefixo `__Host-` em produção).
   - Persistir a sessão em `auth_sessoes` com `senhaVersao` (hash SHA-256 do hash bcrypt), invalidando automaticamente sessões antigas quando a senha for alterada ou o usuário for inativado.
2. Proteção CSRF:
   - Exigir cabeçalho `X-CSRF-Token` correspondente ao cookie `frota_csrf` em todos os métodos mutáveis (POST, PATCH, PUT, DELETE) autenticados por cookie, validando também o cabeçalho `Origin`.
3. Rate Limiting Distribuído sem Vazamento de PII:
   - Limitar tentativas de login (30 por IP / 10 por conta em 15 min) e alteração de senha (10 falhas por usuário em 15 min) na tabela `auth_login_limites`.
   - Armazenar apenas o hash SHA-256 da chave (`escopo:valor`), nunca gravando IP ou e-mail em texto puro na tabela de limites.
```

---

## 4. Prompt de Auditoria Exploratória e Regressão E2E com Playwright

### Versão: `v3.5` (Sprint 11)

#### Prompt Utilizado:

```markdown
Elabore a matriz de testes exploratórios (`docs/MATRIZ_QA_EXPLORATORIA.md`) e as suítes E2E com Playwright (`FrontEnd/tests/e2e/`):

1. Validar fluxos ponta a ponta por perfil (`ADMIN`, `GESTOR`, `SOLICITANTE`, `MOTORISTA`, `SVO`).
2. Testar cenários críticos de concorrência (tentativa de dupla alocação simultânea de veículo/motorista), isolamento RBAC (bloqueio 403 entre perfis) e regressão do ciclo completo do SVO (chamado -> triagem -> ordem de coleta -> deslocamento -> local -> entrega -> desinfecção).
```
