# Prompts — Qualidade, Testes e Linting Estrito (PRM-03)

Este documento registra os prompts utilizados para geração e refatoração de suítes de testes automatizados com **Vitest**, **React Testing Library**, **Supertest/Fetch**, e para adequação às regras do **Oxlint** (`oxlint --deny-warnings`) e **Prettier**.

---

## 1. Prompt de Geração de Testes Unitários para Services do Prisma com Mock Isolado

### Versão: `v2.2`

#### Contexto e Desafio:

Garantir que os testes de serviço no BackEnd não dependam de banco de dados real em execução nos testes unitários rápidos de CI (`npm test`), simulando todos os métodos do Prisma Client com `vitest.mock` e preservando integridade tipada.

#### Prompt Utilizado:

```markdown
Atue como Engenheiro de QA e Especialista em Testes Automatizados com Vitest e TypeScript.
Você deve gerar a suíte de testes unitários para o service `{nome_do_service}.ts`.

REQUISITOS OBRIGATÓRIOS DE QUALIDADE:

1. Mock completo do Prisma Client usando `vi.mock("../config/prisma", () => ({ prisma: { ... } }))`.
2. Testar todos os ramos (happy path, validações de erro, AppError 400/404, conflito de horários).
3. Resetar os mocks antes de cada teste com `beforeEach(() => { vi.clearAllMocks(); })`.
4. Não utilizar 'any' para simular retornos; crie fixtures com a tipagem completa do schema Prisma.
5. Assegurar cobertura dos fluxos assíncronos e rejeição de Promises.
6. Não deixe variáveis ou imports não utilizados (isso falha no oxlint).
```

---

## 2. Prompt de Testes de Componentes React (Hooks, Modais e Eventos de UI)

### Versão: `v2.0`

#### Contexto:

No FrontEnd, os componentes utilizam React 18, Tailwind CSS, Lucide Icons e chamadas assíncronas a serviços da API. Os testes com Vitest e JSDOM devem simular requisições HTTP e interações do usuário.

#### Prompt Utilizado:

```markdown
Gere a suíte de testes unitários com Vitest e `@testing-library/react` para o componente React `{NomeDoComponente}.tsx`.

DIRETRIZES:

1. Use `render`, `screen`, `fireEvent` ou `userEvent` para simular interações do usuário.
2. Mock de módulos de API (ex: `notificacoesService`, `solicitacoesService`) usando `vi.mock(...)`.
3. Para asserções de texto e elementos, use `@testing-library/jest-dom/vitest` (`toBeInTheDocument()`, `toHaveTextContent()`).
4. Teste estados:
   - Estado de carregamento (spinner/skeleton).
   - Estado com dados populados (listagem correta de itens).
   - Estado vazio ("Nenhum registro encontrado").
   - Estado de erro (mensagem amigável com role="alert" e botão de retry).
5. Cuide da sincronia: use `waitFor` ao verificar renderizações que dependem de Promises resolvidas.
```

---

## 3. Prompt de Refatoração de Código e Resolução de Avisos do Linter (`oxlint`)

### Versão: `v1.2`

#### Contexto:

O projeto adota política de **zero tolerância a warnings** no pipeline de CI/CD (`oxlint --deny-warnings`). Qualquer variável não utilizada, dependência faltante em `useEffect`, ou chamada síncrona de `setState` dentro de efeitos bloqueia o build.

#### Prompt Utilizado:

```markdown
Refatore o arquivo a seguir garantindo que passe com ZERO WARNINGS no comando `oxlint --deny-warnings` e `tsc --noEmit`.

REGRAS:

1. Remova imports, variáveis e parâmetros não utilizados.
2. Não invoque setState síncrono no corpo principal do useEffect sem verificação de montagem ou guarda condicional (`react(set-state-in-effect)`).
3. Não use operadores '==' ou '!='; utilize igualdade estrita '===' e '!=='.
4. Garanta que todas as funções assíncronas em handlers tenham tratamento de erro com try/catch ou `.catch()`.
5. Mantenha 100% da funcionalidade e dos testes passando.
```
