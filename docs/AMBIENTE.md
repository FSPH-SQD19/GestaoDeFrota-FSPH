# Ambiente de desenvolvimento e homologação

[Índice da documentação](README.md)

O desenvolvimento usa PostgreSQL com PostGIS local, iniciado pelo Docker Compose. A homologação roda na Cloudflare Workers e acessa o Neon PostgreSQL por meio do Hyperdrive.

## Pré-requisitos

- Git.
- Node.js compatível com `engines` do `package.json`: `^22.12.0 || ^24.0.0 || >=26.0.0`. O CI usa a linha 24; os Dockerfiles usam a linha 22.
- npm, com instalação das dependências pela raiz usando `npm ci`.
- Docker Desktop ou Docker Engine com Compose para o banco local e para executar os serviços em contêineres.

Para clonar o projeto:

```bash
git clone https://github.com/fel1pemsc/GestaoDeFrota-FSPH.git
cd GestaoDeFrota-FSPH
```

## Arquivos de ambiente

| Arquivo local | Modelo | Quem utiliza |
| --- | --- | --- |
| `.env` na raiz | `.env.example` | Credenciais do PostgreSQL local e portas do Docker Compose. |
| `BackEnd/.env` | `BackEnd/.env.example` | API Node local e comandos Prisma executados no computador. |

Crie os arquivos locais a partir dos modelos apenas se ainda não existirem:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path BackEnd/.env)) { Copy-Item BackEnd/.env.example BackEnd/.env }
```

Os arquivos `.env` são ignorados pelo Git. Não versione credenciais reais.

## Desenvolvimento local

O arquivo `.env` da raiz configura o serviço `database` do Compose:

| Variável | Finalidade | Padrão local |
| --- | --- | --- |
| `POSTGRES_DB` | Nome do banco. | `gestao_frota` |
| `POSTGRES_USER` | Usuário do banco. | `postgres` |
| `POSTGRES_PASSWORD` | Senha do banco. | `postgres` |
| `POSTGRES_PORT` | Porta exposta no computador. | `5433` |
| `BACKEND_PORT` | Porta da API exposta pelo Compose. | `3000` |
| `FRONTEND_PORT` | Porta da interface exposta pelo Compose. | `5173` |

O arquivo `BackEnd/.env` configura a API Node e os comandos Prisma executados no computador:

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta da API; o padrão é `3000`. |
| `DATABASE_URL` | Conexão ao PostgreSQL local usada pela API e pelo Prisma. |
| `DATABASE_URL_MIGRATIONS` | Opcional localmente; no deploy de HML, o GitHub Actions usa esse secret com a URL direta do Neon para aplicar migrations. |

O arquivo `BackEnd/.env` usa `localhost:5433` para a API Node e para os comandos Prisma executados no computador. Dentro dos contêineres, o Compose configura a URL com o host `database` e a porta interna `5432`.

Para iniciar apenas o banco local, instale as dependências, aplique as migrations e inicie a API e a interface:

```bash
npm ci
docker compose up -d database
npm exec --workspace=backend -- prisma migrate deploy
npm run dev
```

Para iniciar todos os serviços com Docker:

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

O deploy da branch `hml` roda o back-end como Cloudflare Worker. Em runtime, o Worker usa a binding `HYPERDRIVE`; a configuração dessa binding na Cloudflare precisa apontar para o banco Neon de HML. A connection string não fica no repositório nem é enviada como variável do Worker.

O GitHub Actions executa lint e build, aplica as migrations e publica o Worker. Configure estes secrets no ambiente **GitHub → Settings → Environments → hml**:

| Secret | Uso |
| --- | --- |
| `DATABASE_URL_MIGRATIONS` | URL direta do Neon usada por `prisma migrate deploy`; use a connection string sem pooling. O workflow também a fornece como `DATABASE_URL` para o Prisma. |
| `CLOUDFLARE_API_TOKEN` | Autentica a publicação do Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | Identifica a conta Cloudflare. |
| `JWT_SECRET` | Chave aleatória de 64 bytes codificada em 128 caracteres hexadecimais minúsculos. |

O ID da binding Hyperdrive fica em `wrangler.jsonc`. Confirme no painel da Cloudflare que essa configuração está ligada ao Neon e à branch de banco destinada à HML. O workflow aplica migrations versionadas antes do deploy; use `migrate deploy` em HML e reserve `migrate dev` para desenvolvimento local.

## Prisma e autenticação

O cliente Prisma é gerado no `postinstall` do back-end durante a instalação. Após alterar o schema, regenere o cliente:

```bash
npm run prisma:generate --workspace=backend
```

O schema está em `BackEnd/prisma/schema.prisma`, as migrations em `BackEnd/prisma/migrations` e a configuração em `BackEnd/prisma.config.ts`.

Na API Node local, a primeira inicialização gera uma chave em `BackEnd/.runtime/auth.key` e reutiliza essa chave nas próximas execuções. No Docker, o volume `backend_auth` preserva o arquivo. O Worker de HML recebe `JWT_SECRET` como secret da Cloudflare. Trocar a chave invalida os tokens existentes e exige novo login. A validade dos tokens é fixa em oito horas.

## Endereços e problemas comuns

| Situação | O que conferir |
| --- | --- |
| Interface | `http://localhost:5173`, ou a porta indicada pelo Vite/Compose. |
| API local | `http://localhost:3000/health`, ajustando a porta se necessário. Essa rota não verifica o banco. |
| Falha no banco local | Docker ativo, serviço `database`, porta `5433` e `BackEnd/.env`. |
| Falha no deploy de HML | Secrets do ambiente GitHub `hml`, token e conta Cloudflare, além do acesso ao Neon pela binding Hyperdrive. |
| Falha no login local | Usuário ativo, hash bcrypt, migrations e acesso ao arquivo local da chave; veja [Back-end](BACKEND.md). |
| Erro ao gerar Prisma no Windows | Pare a API antes de regenerar o cliente para liberar os arquivos em uso. |

Consulte [Front-end](FRONTEND.md) para entender as telas. Os testes usam mocks do banco e podem ser executados sem conexão ao Neon ou Docker; veja [Testes](TESTES.md).
