# Ambiente de desenvolvimento e homologação

[Índice da documentação](README.md)

O desenvolvimento usa PostgreSQL com PostGIS local. O ambiente de homologação (HML) usa Neon PostgreSQL. Para consultar os comandos npm, veja [Início](INICIO.md).

## Pré-requisitos

- Git.
- Node.js compatível com `engines` do `package.json`: `^22.12.0 || ^24.0.0 || >=26.0.0`. O CI usa a linha 24; os Dockerfiles usam a linha 22.
- npm, com instalação das dependências pela raiz usando `npm ci`.
- Docker Desktop ou Docker Engine com Compose para o banco local e para executar os serviços em contêineres.
- Projeto e banco PostgreSQL criados no Neon, com suporte à extensão PostGIS, para HML.

Para clonar o projeto:

```bash
git clone https://github.com/fel1pemsc/GestaoDeFrota-FSPH.git
cd GestaoDeFrota-FSPH
```

## Arquivos de ambiente

| Arquivo local  | Modelo                 | Quem utiliza                                          |
| -------------- | ---------------------- | ----------------------------------------------------- |
| `.env` na raiz | `.env.example`         | PostgreSQL local e Docker Compose de desenvolvimento. |
| `BackEnd/.env` | `BackEnd/.env.example` | API e comandos Prisma executados localmente.          |

Crie os arquivos locais a partir dos modelos apenas se ainda não existirem:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path BackEnd/.env)) { Copy-Item BackEnd/.env.example BackEnd/.env }
```

Os arquivos `.env` são ignorados pelo Git. Não versione credenciais reais.

## Desenvolvimento local

O arquivo `.env` da raiz define as credenciais do PostgreSQL local iniciado pelo Compose:

| Variável            | Finalidade                               | Padrão local   |
| ------------------- | ---------------------------------------- | -------------- |
| `POSTGRES_DB`       | Nome do banco.                           | `gestao_frota` |
| `POSTGRES_USER`     | Usuário do banco.                        | `postgres`     |
| `POSTGRES_PASSWORD` | Senha do banco.                          | `postgres`     |
| `POSTGRES_PORT`     | Porta exposta no computador.             | `5433`         |
| `BACKEND_PORT`      | Porta da API exposta pelo Compose.       | `3000`         |
| `FRONTEND_PORT`     | Porta da interface exposta pelo Compose. | `5173`         |

O arquivo `BackEnd/.env` usa `localhost:5433` para a API e os comandos Prisma executados no computador. Dentro dos contêineres, o Compose define a URL com o host `database` e a porta interna `5432`.

Para iniciar apenas o banco local:

```bash
docker compose up -d database
```

Na raiz do projeto, instale as dependências, aplique as migrations locais e inicie a API e a interface:

```bash
npm ci
npm exec --workspace=backend -- prisma migrate deploy
npm run dev
```

Para iniciar todos os serviços em contêineres, incluindo o banco local:

```bash
docker compose up --build
```

Depois que os contêineres iniciarem, aplique as migrations ao banco local:

```bash
docker compose exec backend npx prisma migrate deploy
```

Para criar uma migration durante o desenvolvimento, use o banco local:

```bash
npm run prisma:migrate --workspace=backend
```

## Homologação com Neon

Configure a variável `DATABASE_URL` no ambiente de execução de HML com a connection string do banco Neon. Não coloque credenciais em arquivos versionados. O schema Prisma e a API usam essa mesma variável; o banco Neon precisa permitir PostGIS para aplicar a migration inicial.

Para aplicar migrations no banco de HML, configure a mesma `DATABASE_URL` como variável secreta no ambiente de deploy e execute:

```bash
npm exec --workspace=backend -- prisma migrate deploy
```

Confira se a variável aponta para o banco Neon de homologação antes de executar. Use `migrate deploy` para migrations versionadas; reserve `migrate dev` para desenvolvimento local.

## Prisma e autenticação

O cliente Prisma é gerado no `postinstall` do back-end durante a instalação. Após alterar o schema, pare a API e regenere o cliente:

```bash
npm run prisma:generate --workspace=backend
```

O schema está em `BackEnd/prisma/schema.prisma`, as migrations em `BackEnd/prisma/migrations` e a configuração em `BackEnd/prisma.config.ts`.

Na primeira inicialização, a API gera uma chave aleatória em `BackEnd/.runtime/auth.key` e a reutiliza nas próximas execuções. No Docker, o volume `backend_auth` preserva essa chave. Remover o volume ou o arquivo invalida os tokens existentes e exige novo login. A validade dos tokens é fixa em oito horas.

## Endereços e problemas comuns

| Situação                        | O que conferir                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interface                       | `http://localhost:5173`, ou a porta indicada pelo Vite/Compose.                                         |
| API                             | `http://localhost:3000/health`, ajustando a porta se necessário. Essa rota não verifica o banco.        |
| Falha no banco local            | Docker ativo, serviço `database`, porta `5433` e `BackEnd/.env`.                                        |
| Falha no banco de HML           | Variável secreta `DATABASE_URL`, credenciais, SSL, PostGIS e destino Neon.                              |
| Falha no login da API           | Usuário ativo, hash bcrypt, migrations e acesso ao arquivo local da chave; veja [Back-end](BACKEND.md). |
| Erro ao gerar Prisma no Windows | Pare a API antes de regenerar o cliente para liberar os arquivos em uso.                                |

Consulte [Front-end](FRONTEND.md) para entender as telas. Os testes usam mocks do banco e podem ser executados sem banco local, conexão ao Neon ou Docker; veja [Testes](TESTES.md).
