# Como criar e executar testes unitários

O projeto usa Vitest para os testes dos dois workspaces, Testing Library com jsdom para os componentes React e Oxlint para a análise estática. As dependências são instaladas pelo `package-lock.json` da raiz e compartilhadas no `node_modules` central.

Use uma versão de Node compatível com `engines` do `package.json`: linha 22 a partir de 22.12, linha 24 ou versão 26 em diante.

## Comandos pela raiz

Abra o terminal na pasta raiz do projeto, onde está o `package.json` com os workspaces `BackEnd` e `FrontEnd`. Instale as dependências com `npm ci` antes da primeira execução. Não é necessário iniciar o front-end ou a API para rodar os testes unitários.

```bash
# Instalar as versões do lockfile
npm ci

# Executar todos os testes uma vez, com checagem de tipos dos testes
npm test

# Reexecutar os testes dos dois projetos quando os arquivos mudarem
npm run test:watch

# Gerar os relatórios de cobertura dos dois projetos
npm run test:coverage

# Verificar o código dos dois projetos
npm run lint

# Aplicar as correções automáticas disponíveis no linter
npm run lint:fix

# Pipeline local completo: lint, testes e builds
npm run check
```

`lint:fix` pode alterar arquivos. Os demais comandos de verificação podem gerar apenas caches, artefatos de build e relatórios ignorados pelo Git.

Também é possível selecionar um workspace:

```bash
npm test --workspace=backend
npm run test:watch --workspace=frontend
npm run test:coverage --workspace=backend
npm run lint --workspace=frontend
```

No modo watch, use os controles do Vitest ou `Ctrl+C` para encerrar.

### Executar apenas um arquivo

Ainda na raiz, indique o workspace e passe o caminho do teste depois de `--`. O caminho é relativo à pasta do workspace escolhido:

```bash
# Um arquivo do back-end, incluindo a checagem de tipos do workspace
npm test --workspace=backend -- tests/unit/service/auditoria_s.test.ts

# Um arquivo do front-end, incluindo a checagem de tipos do workspace
npm test --workspace=frontend -- tests/unit/components/Button.test.tsx

# Acompanhar alterações em um arquivo do front-end
npm run test:watch --workspace=frontend -- tests/unit/components/Button.test.tsx
```

O modo watch executa os testes, mas não faz a checagem de tipos definida em `test:types`. Antes de concluir uma alteração, execute `npm test` ou `npm run check`.

## Organização

```text
.oxlintrc.json                      Regras comuns e exclusão de arquivos gerados
BackEnd/
  .oxlintrc.json                    Configuração Node/TypeScript
  vitest.config.mts                 Ambiente Node, descoberta dos testes e cobertura
  tsconfig.test.json                Checagem de tipos dos testes sem emitir arquivos
  tests/unit/
    controller/auth_c.test.ts       Validação das entradas e respostas do login
    service/auth_s.test.ts          Credenciais, perfis, assinatura JWT e erros
    service/password_s.test.ts      Hashes com salt e verificação de senhas
    service/auditoria_s.test.ts     Dados enviados à persistência da auditoria
FrontEnd/
  .oxlintrc.json                    Configuração React/TypeScript
  vitest.config.ts                  Ambiente jsdom, setup e cobertura
  tsconfig.test.json                Checagem de tipos dos testes e componentes usados
  tests/
    setup.ts                       Matchers DOM, limpeza do DOM e do armazenamento
    unit/components/
      Button.test.tsx              Cliques, estado desabilitado e carregamento
      Input.test.tsx               Visibilidade da senha e mensagens dos campos
    unit/lib/utils.test.ts         Classes condicionais e conflitos de Tailwind
```

Os testes ficam fora de `src` para separar a aplicação do código de teste. As configurações de build continuam compilando somente o código de produção; `test:types` verifica os testes separadamente.

O Tailwind ignora `FrontEnd/tests` ao detectar classes, evitando que classes usadas apenas nos testes aumentem o CSS de produção.

## Como criar um teste

1. Escolha uma função, serviço ou componente e um comportamento que precisa garantir.
2. Crie o arquivo na pasta `tests/unit` do workspace correspondente. Use `.test.ts` para funções e serviços e `.test.tsx` para componentes com JSX.
3. Importe o código real que será testado. Ajuste os caminhos relativos conforme a localização do novo arquivo.
4. Prepare as entradas e os mocks necessários, execute a ação e confira o resultado com `expect`.
5. Execute o arquivo individualmente durante o desenvolvimento e a suíte completa ao terminar.

Um teste costuma ter três partes: **preparação** dos dados, **execução** da ação e **verificação** do resultado. Cada `it` deve explicar o comportamento esperado.

| Recurso | Uso |
| --- | --- |
| `describe` | Agrupa os testes de uma função ou componente. |
| `it` | Define um cenário de teste. |
| `expect` | Verifica um resultado ou uma interação. |
| `vi.fn` | Cria uma função simulada e registra suas chamadas. |
| `vi.mock` | Substitui um módulo, como o acesso ao banco. |
| `beforeEach` | Executa a preparação antes de cada cenário. |

### Exemplo no back-end: serviço com acesso ao banco

O exemplo abaixo segue o teste existente em `BackEnd/tests/unit/service/auditoria_s.test.ts`. Use-o como modelo para novos serviços; não é necessário criar uma cópia desse teste.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Disponibiliza o mock para a substituição do módulo feita pelo Vitest.
const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../../../src/lib/prisma', () => ({
  prisma: { auditoriaSistema: { create: mocks.create } },
}))

import { registrarAuditoria } from '../../../src/service/auditoria_s'

describe('registrarAuditoria', () => {
  beforeEach(() => vi.resetAllMocks())

  it('usa null nos campos opcionais quando não são informados', async () => {
    // Preparação
    const input = {
      acao: 'CRIAR',
      tabelaAfetada: 'veiculos',
      dadosNovos: { placa: 'ABC1D23' },
    }
    const registro = { id: 'auditoria-teste' }
    mocks.create.mockResolvedValue(registro)

    // Execução
    const resultado = await registrarAuditoria(input)

    // Verificação
    expect(resultado).toBe(registro)
    expect(mocks.create).toHaveBeenCalledWith({
      data: { ...input, usuarioId: null, registroId: null },
    })
  })

  it('propaga uma falha da persistência', async () => {
    mocks.create.mockRejectedValue(new Error('Falha simulada'))

    await expect(registrarAuditoria({
      acao: 'CRIAR',
      tabelaAfetada: 'veiculos',
      dadosNovos: { placa: 'ABC1D23' },
    })).rejects.toThrow('Falha simulada')
  })
})
```

O Prisma é substituído pelo mock, portanto nenhuma conexão ou gravação real acontece. O segundo cenário ilustra como adicionar um caso de erro. Para testar funções puras, importe a função diretamente e dispense o mock de banco.

Use `await` nas operações assíncronas, inclusive em `expect(...).resolves` e `expect(...).rejects`, para que o teste aguarde a verificação.

### Exemplo no front-end: interação com componente

O exemplo abaixo usa o componente real `Button` e segue `FrontEnd/tests/unit/components/Button.test.tsx`. Para testar outro componente, crie um arquivo próprio e adapte a renderização, a ação e o resultado esperado.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../../src/components/common/Button'

describe('Button', () => {
  it('chama a ação ao clicar em Salvar', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Salvar</Button>)

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('impede o clique quando está desabilitado', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button disabled onClick={onClick}>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })

    expect(button).toBeDisabled()
    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
```

O jsdom fornece o ambiente DOM. O arquivo `FrontEnd/tests/setup.ts` já carrega os matchers, como `toBeDisabled` e `toBeInTheDocument`, e limpa o DOM e os armazenamentos entre os testes. Não é preciso repetir esse setup em cada arquivo.

Prefira `getByRole` e `getByLabelText` para localizar elementos. Use `queryByRole` quando quiser verificar que um elemento não existe e `await screen.findByRole(...)` quando ele aparecer após uma operação assíncrona. Componentes que usam contexto ou roteamento precisam dos respectivos providers na renderização do teste.

### O que cobrir em cada novo teste

- Caminho de sucesso e resultado esperado.
- Entradas inválidas e casos de limite que façam parte do contrato da função.
- Falhas de dependências, quando o código precisa tratar ou propagar esses erros.
- Estados relevantes dos componentes, como desabilitado, carregando e mensagens de erro.

Evite testar somente o funcionamento de um mock. Verifique o comportamento do código real que o utiliza. Quando corrigir um bug, acrescente um cenário que reproduza a falha e passe depois da correção.

## Convenções para novos testes

- Use arquivos `*.test.ts` ou `*.test.tsx` dentro de `tests/unit`, agrupados pela responsabilidade testada.
- Importe `describe`, `it`, `expect` e `vi` de `vitest`; os testes não dependem de funções globais implícitas.
- Descreva o comportamento esperado e verifique resultados observáveis, incluindo os caminhos de erro relevantes.
- No front-end, localize os controles por papel, rótulo ou texto e use `userEvent` para as interações.
- Isole banco e serviços externos com mocks. Os testes iniciais de autenticação e auditoria substituem o módulo `src/lib/prisma` antes de importar o código testado.
- Use dados sintéticos. Altere variáveis de ambiente com `vi.stubEnv`; o Vitest restaura as alterações entre os testes.
- Mantenha os testes independentes. A configuração limpa chamadas de mocks e restaura os spies; os testes que mudam implementações usam `vi.resetAllMocks`.

Os testes unitários não exigem Docker, banco de dados, usuários cadastrados ou segredos reais. O teste de senhas usa bcrypt real e os testes de autenticação verificam a assinatura JWT com uma chave sintética. Testes de integração com banco e testes completos de navegador devem ser organizados separadamente quando forem adicionados.

## Lint

Os dois projetos herdam as regras comuns da `.oxlintrc.json` da raiz. O front-end acrescenta as regras React e o back-end habilita o ambiente Node. O lint verifica código, configurações e testes; ignora `node_modules`, `dist` e `coverage`.

Os scripts usam `--deny-warnings`: erros e avisos fazem o comando terminar com falha. O linter não substitui a checagem de tipos do TypeScript.

## Cobertura

Os relatórios usam o provedor V8 e são gerados em:

- `BackEnd/coverage/index.html`
- `FrontEnd/coverage/index.html`
- `coverage-summary.json` dentro de cada pasta de cobertura, para consumo por ferramentas.

No back-end, a medição inclui os serviços e controllers. No front-end, inclui o código de `src`, exceto o ponto de montagem `main.tsx` e os arquivos de tipos. Arquivos ainda sem testes também entram na medição; não há percentual mínimo obrigatório nesta estrutura inicial.

As pastas de cobertura são ignoradas pelo Git. Os caches do Vitest e do TypeScript ficam sob o `node_modules` da raiz.

## CI nos pull requests

O workflow está em `.github/workflows/ci.yml` e executa no GitHub Actions quando um PR é aberto, recebe novos commits, é reaberto ou passa de rascunho para pronto para revisão. Vale para PRs destinados a qualquer branch, inclusive rascunhos. Também permite execução manual pela aba **Actions**, quando o workflow estiver disponível na branch padrão.

O job **Lint, testes e build** usa Ubuntu e Node.js 24. As etapas são:

1. Obter o código do PR.
2. Configurar Node.js e o cache de downloads do npm, usando o lockfile da raiz como referência.
3. Executar `npm ci` na raiz, instalando os dois workspaces e gerando o Prisma Client pelo `postinstall` do back-end.
4. Executar `npm run lint` nos dois projetos.
5. Executar `npm test`, incluindo a checagem de tipos dos testes e as suítes unitárias dos dois projetos.
6. Executar `npm run build` para compilar o back-end e o front-end.

Uma falha interrompe as etapas seguintes e deixa a verificação do PR com falha. Novos commits cancelam uma execução anterior ainda em andamento no mesmo PR. O limite de cada execução é de 15 minutos.

Os testes atuais usam mocks para o banco e dados sintéticos para autenticação. O workflow não precisa de PostgreSQL, Docker ou secrets cadastrados no GitHub. A cobertura continua disponível pelo comando local `npm run test:coverage`; ela não é uma etapa deste CI.

### Acompanhar o resultado

Ao terminar a verificação de um PR da equipe (branch no próprio repositório), o bot `github-actions` publica um comentário com o resultado geral e o status de dependências, lint, testes/tipos e build. O resumo inclui o commit e o link da execução. Nas próximas execuções, o mesmo comentário é atualizado.

Se uma etapa falhar, o comentário indica a falha e marca as etapas seguintes como não executadas. Execuções canceladas não publicam o resumo. O job de comentários usa `pull-requests: write`; o job que instala e executa o código continua com permissão apenas de leitura. Execuções manuais e PRs de forks não publicam esse comentário.

Após enviar o workflow e os arquivos necessários do projeto para a branch do PR, abra a aba **Checks** do PR ou a aba **Actions** do repositório. Se uma etapa falhar, abra seus logs, corrija a causa e envie um novo commit para executar novamente.

Para reproduzir as mesmas verificações localmente, execute `npm ci` e depois `npm run check` na raiz. O ambiente local pode usar outro sistema operacional; o CI executa em Linux.

Criar o workflow exibe a verificação no PR. Para exigir sua aprovação antes do merge, um administrador precisa marcar **Lint, testes e build** como verificação obrigatória nas regras da branch do GitHub, após a primeira execução. Essa regra não é definida pelo arquivo do workflow.

Referências: [eventos de pull request no GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [checkout](https://github.com/actions/checkout) e [setup-node](https://github.com/actions/setup-node).

## Como interpretar falhas

Ao executar os testes, o Vitest mostra os arquivos e cenários que passaram ou falharam. Em uma falha de asserção, compare `Expected` (esperado) com `Received` (recebido) e confira a linha indicada. Comandos bem-sucedidos terminam com código de saída `0`; falhas retornam código diferente de zero.

| Situação | O que conferir |
| --- | --- |
| Nenhum teste encontrado | Pasta `tests/unit`, extensão `.test.ts` ou `.test.tsx` e workspace escolhido. |
| Erro de TypeScript antes dos testes | Saída de `test:types`; corrija os tipos apontados antes de executar novamente. |
| Módulo não encontrado | Caminho do import relativo ao arquivo de teste e dependências instaladas na raiz. |
| Tentativa de acessar banco real | Mock de `src/lib/prisma`, com o caminho correto, antes de carregar o serviço testado. |
| Elemento não encontrado | Papel, nome ou rótulo renderizado; use `findByRole` se a atualização for assíncrona. |
| Teste passa sozinho e falha com os demais | Estado compartilhado, implementações de mocks, timers ou variáveis de ambiente não restaurados. |
| Lint falha com aviso | Os scripts usam `--deny-warnings`; avisos também precisam ser resolvidos. |

Referências: [configuração do Vitest](https://vitest.dev/config/), [cobertura do Vitest](https://vitest.dev/guide/coverage) e [configuração do Oxlint](https://oxc.rs/docs/guide/usage/linter/config-file-reference).
