# Testes, lint e cobertura

[Índice da documentação](README.md)

O projeto usa Vitest para os testes dos dois workspaces, Testing Library com jsdom para os componentes React e Oxlint para a análise estática. As dependências são instaladas pelo `package-lock.json` da raiz e compartilhadas no `node_modules` central.

Use uma versão de Node compatível com `engines` do `package.json`: linha 22 a partir de 22.12, linha 24 ou versão 26 em diante.

## Sumário

- [Comandos pela raiz](#comandos-pela-raiz)
- [Organização](#organização)
- [Como criar um teste](#como-criar-um-teste)
- [Convenções para novos testes](#convenções-para-novos-testes)
- [Lint](#lint)
- [Cobertura](#cobertura)
- [CI nos pull requests](#ci-nos-pull-requests)
- [Como interpretar falhas](#como-interpretar-falhas)
- [Referências](#referências)

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
    service/veiculo_s.test.ts       Filtros, validações, criação e erros de veículos
    routes/veiculo_r.test.ts        Requisições HTTP, autenticação e respostas de veículos
    routes/auth_r.test.ts           Login, perfil e admin nos dois prefixos de auth
    middleware/auth.test.ts         Contrato comum de autenticação e autorização
    config/auth.test.ts             Geração e persistência da chave local, validade fixa de oito horas
    config/server.test.ts           Inicialização interrompida se a chave local falhar
    prisma/seed.test.ts             Reexecução do seed com persistência em memória
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

| Recurso      | Uso                                                |
| ------------ | -------------------------------------------------- |
| `describe`   | Agrupa os testes de uma função ou componente.      |
| `it`         | Define um cenário de teste.                        |
| `expect`     | Verifica um resultado ou uma interação.            |
| `vi.fn`      | Cria uma função simulada e registra suas chamadas. |
| `vi.mock`    | Substitui um módulo, como o acesso ao banco.       |
| `beforeEach` | Executa a preparação antes de cada cenário.        |

### Exemplo no back-end: serviço com acesso ao banco

O exemplo abaixo segue o teste existente em `BackEnd/tests/unit/service/auditoria_s.test.ts`. Use-o como modelo para novos serviços; não é necessário criar uma cópia desse teste.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Disponibiliza o mock para a substituição do módulo feita pelo Vitest.
const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: { auditoriaSistema: { create: mocks.create } },
}));

import { registrarAuditoria } from "../../../src/service/auditoria_s";

describe("registrarAuditoria", () => {
  beforeEach(() => vi.resetAllMocks());

  it("usa null nos campos opcionais quando não são informados", async () => {
    // Preparação
    const input = {
      acao: "CRIAR",
      tabelaAfetada: "veiculos",
      dadosNovos: { placa: "ABC1D23" },
    };
    const registro = { id: "auditoria-teste" };
    mocks.create.mockResolvedValue(registro);

    // Execução
    const resultado = await registrarAuditoria(input);

    // Verificação
    expect(resultado).toBe(registro);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { ...input, usuarioId: null, registroId: null },
    });
  });

  it("propaga uma falha da persistência", async () => {
    mocks.create.mockRejectedValue(new Error("Falha simulada"));

    await expect(
      registrarAuditoria({
        acao: "CRIAR",
        tabelaAfetada: "veiculos",
        dadosNovos: { placa: "ABC1D23" },
      }),
    ).rejects.toThrow("Falha simulada");
  });
});
```

O Prisma é substituído pelo mock, portanto nenhuma conexão ou gravação real acontece. O segundo cenário ilustra como adicionar um caso de erro. Para testar funções puras, importe a função diretamente e dispense o mock de banco.

Use `await` nas operações assíncronas, inclusive em `expect(...).resolves` e `expect(...).rejects`, para que o teste aguarde a verificação.

### Exemplo no front-end: interação com componente

O exemplo abaixo usa o componente real `Button` e segue `FrontEnd/tests/unit/components/Button.test.tsx`. Para testar outro componente, crie um arquivo próprio e adapte a renderização, a ação e o resultado esperado.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../src/components/common/Button";

describe("Button", () => {
  it("chama a ação ao clicar em Salvar", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Salvar</Button>);

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("impede o clique quando está desabilitado", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Salvar" });

    expect(button).toBeDisabled();
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
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
- Isole banco e serviços externos com mocks. Os testes de autenticação e auditoria substituem o módulo `src/lib/prisma` antes de importar o código testado.
- Use dados sintéticos. Altere variáveis de ambiente com `vi.stubEnv`; o Vitest restaura as alterações entre os testes.
- Mantenha os testes independentes. A configuração limpa chamadas de mocks e restaura os spies; os testes que mudam implementações usam `vi.resetAllMocks`.

Os testes unitários não exigem Docker, banco de dados, usuários cadastrados ou segredos reais. O teste de senhas usa bcrypt real e os testes de autenticação verificam a assinatura JWT com uma chave sintética. A suíte também contém testes HTTP de veículos em `tests/unit/routes`: eles iniciam a aplicação em uma porta local temporária e fazem requisições reais ao Express, mantendo o Prisma simulado. Esses cenários verificam a integração das rotas, middlewares e controllers, sem banco externo. Organize os testes com banco real e os testes completos de navegador separadamente dos testes com dependências isoladas.

## Lint

Os dois projetos herdam as regras comuns da `.oxlintrc.json` da raiz. O front-end acrescenta as regras React e o back-end habilita o ambiente Node. O lint verifica código, configurações e testes; ignora `node_modules`, `dist` e `coverage`.

Os scripts usam `--deny-warnings`: erros e avisos fazem o comando terminar com falha. O linter não substitui a checagem de tipos do TypeScript.

## Cobertura

Os relatórios usam o provedor V8 e são gerados em:

- `BackEnd/coverage/index.html`
- `FrontEnd/coverage/index.html`
- `coverage-summary.json` dentro de cada pasta de cobertura, para consumo por ferramentas.

No back-end, a medição inclui os serviços e controllers. No front-end, inclui o código de `src`, exceto o ponto de montagem `main.tsx` e os arquivos de tipos. A medição considera todos os arquivos definidos na configuração, incluindo os que não possuem testes. Os relatórios servem para identificar os caminhos que precisam de novos cenários.

As pastas de cobertura são ignoradas pelo Git. Os caches do Vitest e do TypeScript ficam sob o `node_modules` da raiz.

## CI nos pull requests

O funcionamento do workflow, os gatilhos, as permissões e o comentário automático estão no [guia de CI](CI.md).

## Como interpretar falhas

Ao executar os testes, o Vitest mostra os arquivos e cenários que passaram ou falharam. Em uma falha de asserção, compare `Expected` (esperado) com `Received` (recebido) e confira a linha indicada. Comandos bem-sucedidos terminam com código de saída `0`; falhas retornam código diferente de zero.

| Situação                                  | O que conferir                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Nenhum teste encontrado                   | Pasta `tests/unit`, extensão `.test.ts` ou `.test.tsx` e workspace escolhido.                   |
| Erro de TypeScript antes dos testes       | Saída de `test:types`; corrija os tipos apontados antes de executar novamente.                  |
| Módulo não encontrado                     | Caminho do import relativo ao arquivo de teste e dependências instaladas na raiz.               |
| Tentativa de acessar banco real           | Mock de `src/lib/prisma`, com o caminho correto, antes de carregar o serviço testado.           |
| Elemento não encontrado                   | Papel, nome ou rótulo renderizado; use `findByRole` se a atualização for assíncrona.            |
| Teste passa sozinho e falha com os demais | Estado compartilhado, implementações de mocks, timers ou variáveis de ambiente não restaurados. |
| Lint falha com aviso                      | Os scripts usam `--deny-warnings`; avisos também precisam ser resolvidos.                       |

## Referências

[configuração do Vitest](https://vitest.dev/config/), [cobertura do Vitest](https://vitest.dev/guide/coverage) e [configuração do Oxlint](https://oxc.rs/docs/guide/usage/linter/config-file-reference).
