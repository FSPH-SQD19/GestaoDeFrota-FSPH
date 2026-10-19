# Fluxo de trabalho da equipe

A branch principal é a `master`. Cada tarefa deve ser feita em uma branch própria e enviada para a `master` por um pull request (PR).

Execute os comandos na raiz do projeto.

## 1. Criar uma branch

Antes de começar, confira se não há alterações pendentes de outra tarefa com `git status`. Depois, atualize a `master` e crie sua branch:

```bash
git switch master
git pull --ff-only origin master
git switch -c cadastro-veiculos
```

## 2. Fazer as alterações e o commit

Depois de implementar, execute as verificações e confira os arquivos alterados:

```bash
npm run check
git status
git diff
```

O `check` executa lint, testes e build dos dois projetos. Os detalhes estão no [guia de testes](TESTES.md).

Se estiver tudo certo, prepare os arquivos e faça o commit:

```bash
git add .
git diff --cached
git commit -m "feat: adicionar cadastro de veículos"
```

O `git add .` inclui todas as alterações não ignoradas da pasta atual. Confira o conteúdo com `git diff --cached` e inclua apenas arquivos da tarefa, sem credenciais ou arquivos `.env`.

Use mensagens claras. Exemplos: `feat: adicionar cadastro de veículos`, `fix: corrigir validação do login` e `docs: atualizar guia de testes`.

## 3. Enviar a branch

```bash
git push -u origin cadastro-veiculos
```

Use o nome da branch criada no primeiro passo. Nos próximos envios dessa mesma branch, basta usar `git push`.

## 4. Abrir o PR

1. Abra o repositório no GitHub e clique em **Compare & pull request**.
2. Selecione **base: master** e **compare: sua branch**.
3. Coloque um título claro e uma descrição curta do que mudou e como conferir.
4. Crie o PR e peça a revisão de alguém da equipe.
5. Aguarde o CI passar na aba **Checks** e trate os comentários antes do merge.

Exemplo de descrição:

```markdown
## O que mudou
- Adicionado cadastro de veículos.

## Como foi verificado
- npm run check executado com sucesso.
```

Informe apenas as verificações que realmente executou.

Se precisar corrigir algo, faça outro commit e envie com `git push` na mesma branch. O PR será atualizado e o CI rodará novamente.

## 5. Depois do merge

Com as alterações locais salvas em commits, volte para a `master` e atualize:

```bash
git switch master
git pull --ff-only origin master
```

Para a próxima tarefa, crie uma nova branch.

