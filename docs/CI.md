# Integração contínua nos pull requests

[Índice da documentação](README.md)

Guia do workflow de verificação e do resumo publicado nos PRs da equipe.

## Quando executa

O [workflow](../.github/workflows/ci.yml) está em `.github/workflows/ci.yml` e executa no GitHub Actions quando um PR é aberto, recebe novos commits, é reaberto ou passa de rascunho para pronto para revisão. Vale para PRs destinados a qualquer branch, inclusive rascunhos. Também permite execução manual pela aba **Actions**, quando o workflow estiver disponível na branch padrão `master`.

## Etapas da verificação

O job **Lint, testes e build** usa Ubuntu e Node.js 24. As etapas são:

1. Obter o código do PR.
2. Configurar Node.js e o cache de downloads do npm, usando o lockfile da raiz como referência.
3. Executar `npm ci` na raiz, instalando os dois workspaces e gerando o Prisma Client pelo `postinstall` do back-end.
4. Executar `npm run lint` nos dois projetos.
5. Executar `npm test`, incluindo a checagem de tipos dos testes e as suítes unitárias dos dois projetos.
6. Executar `npm run build` para compilar o back-end e o front-end.

Uma falha interrompe as etapas seguintes e deixa a verificação do PR com falha. Novos commits cancelam uma execução anterior ainda em andamento no mesmo PR. O job de qualidade tem limite de 15 minutos; o job de comentários tem limite de 5 minutos.

Os testes usam mocks para o banco e dados sintéticos para autenticação. O workflow não precisa de PostgreSQL, Docker ou secrets cadastrados no GitHub. Use `npm run test:coverage` para gerar relatórios de cobertura localmente.

## Acompanhar o resultado

Ao terminar a verificação de um PR da equipe (branch no próprio repositório), o bot `github-actions` publica o comentário **O olho que tudo vê**, com o resultado geral e o status de dependências, lint, testes/tipos e build. O resumo inclui o commit e o link da execução. Nas próximas execuções, o mesmo comentário é atualizado.

Se uma etapa falhar, o comentário indica a falha e marca as etapas seguintes como não executadas. Execuções canceladas não publicam o resumo. O job de comentários usa `pull-requests: write`; o job que instala e executa o código continua com permissão apenas de leitura. Execuções manuais e PRs de forks não publicam esse comentário.

Após enviar o workflow e os arquivos necessários do projeto para a branch do PR, abra a aba **Checks** do PR ou a aba **Actions** do repositório. Se uma etapa falhar, abra seus logs, corrija a causa e envie um novo commit para executar novamente.

Para reproduzir as mesmas verificações localmente, execute `npm ci` e depois `npm run check` na raiz. O ambiente local pode usar outro sistema operacional; o CI executa em Linux.

## Exigir a verificação antes do merge

Criar o workflow exibe a verificação no PR. Para exigir sua aprovação antes do merge, um administrador precisa marcar **Lint, testes e build** como verificação obrigatória nas regras da branch `master` do GitHub, após a primeira execução. Essa regra não é definida pelo arquivo do workflow.

## Referências

[eventos de pull request no GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [checkout](https://github.com/actions/checkout) e [setup-node](https://github.com/actions/setup-node).
