# Documentação do ROTA

Guias do Sistema de Gestão de Frota e SVO da FSPH. Comece pelo documento que corresponde à sua tarefa.

## Guias

| Documento | Conteúdo |
| --- | --- |
| [Início](INICIO.md) | Comandos npm e divisão das pastas. |
| [Projeto](PROJETO.md) | Contexto, escopo, regras de negócio, tecnologias, equipe e licença. |
| [Ambiente](AMBIENTE.md) | Node.js, variáveis de ambiente, banco, migrations e Docker. |
| [Front-end](FRONTEND.md) | Organização das telas, componentes, perfis e padrões de interface. |
| [Back-end](BACKEND.md) | Organização da API, autenticação, endpoints e regras de veículos. |
| [Testes](TESTES.md) | Como criar e executar testes, lint e cobertura. |
| [CI](CI.md) | Verificações nos PRs e comentário automático do bot. |
| [GitHub](GITHUB.md) | Fluxo da equipe: branch, commit, PR e merge na `master`. |
| [Identidade visual](IDENTIDADE_VISUAL.md) | Marca ROTA, cores, tipografia, arquivos e aplicações. |

## Por onde começar

- **Rodar o projeto:** leia [Início](INICIO.md); configure [Ambiente](AMBIENTE.md) para configurar o banco e a API.
- **Implementar uma tarefa:** consulte [Front-end](FRONTEND.md) ou [Back-end](BACKEND.md), depois [Testes](TESTES.md).
- **Enviar uma alteração:** siga [GitHub](GITHUB.md) e acompanhe o [CI](CI.md).
- **Entender o produto:** leia [Projeto](PROJETO.md).

## Padrão dos documentos

- Arquivos em `docs`, com nomes em maiúsculas, sem espaços ou acentos e com `_` para separar palavras.
- Texto em português, um título principal por arquivo e seções com nomes diretos.
- Guias curtos para tarefas do dia a dia; exemplos técnicos nos documentos do assunto correspondente.
- Comandos executados na raiz do repositório, salvo indicação explícita.
- Caminhos de código relativos à raiz, exceto quando o documento definir a pasta de referência.
- Links relativos entre documentos, evitando duplicar explicações extensas.
- Priorizar a proposta do projeto, a organização e as orientações de trabalho da equipe; acompanhar tarefas e andamento nas issues e nos PRs.
- Ao mudar scripts, endpoints, variáveis ou arquivos, atualizar os guias e links afetados no mesmo PR.

O [README da raiz](../README.md) é a entrada do repositório. Os detalhes do projeto ficam nesta pasta.
