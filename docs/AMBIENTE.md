# Ambiente de desenvolvimento

[Índice da documentação](README.md)

Configuração para executar o projeto localmente ou com Docker. Para consultar apenas os comandos npm, veja [Início](INICIO.md).

## Pré-requisitos

- Git.
- Node.js compatível com `engines` do `package.json`: `^22.12.0 || ^24.0.0 || >=26.0.0`. O CI usa a linha 24; os Dockerfiles usam a linha 22.
- npm, com instalação das dependências pela raiz usando `npm ci`.
- PostgreSQL com PostGIS disponível para aplicar a migration inicial e usar as funcionalidades reais da API que consultam ou gravam dados.
- Docker Desktop ou Docker Engine com Compose, se optar por iniciar o banco ou todos os serviços em contêineres.

Para clonar o projeto:

```bash
git clone https://github.com/fel1pemsc/GestaoDeFrota-FSPH.git
cd GestaoDeFrota-FSPH
```

## Arquivos de ambiente

| Arquivo local | Modelo | Quem utiliza |
| --- | --- | --- |
| `.env` na raiz | `.env.example` | Docker Compose. |
| `BackEnd/.env` | `BackEnd/.env.example` | API e comandos Prisma executados pelo workspace do back-end. |

Crie os arquivos locais a partir dos modelos apenas se ainda não existirem. No PowerShell, por exemplo:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path BackEnd/.env)) { Copy-Item BackEnd/.env.example BackEnd/.env }
```

### Variáveis da raiz

| Variável | Finalidade | Valor de referência local |
| --- | --- | --- |
| `POSTGRES_DB` | Nome do banco. | `gestao_frota` |
| `POSTGRES_USER` | Usuário do banco. | `postgres` |
| `POSTGRES_PASSWORD` | Senha do banco. | Definir no ambiente local. |
| `POSTGRES_PORT` | Porta do banco exposta no computador. | `5433` |
| `BACKEND_PORT` | Porta da API exposta pelo Compose. | `3000` |
| `FRONTEND_PORT` | Porta da interface exposta pelo Compose. | `5173` |
| `JWT_SECRET` | Chave usada pela API para assinar e verificar tokens. | Gerar uma chave própria. |

### Variáveis do back-end

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta da API no desenvolvimento local; o código usa `3000` se não for informada. |
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma. |
| `JWT_SECRET` | Chave para autenticação com JWT. |

Exemplo de estrutura da URL para uma API executada no computador:

```text
postgresql://USUARIO:SENHA@localhost:5433/gestao_frota?schema=public
```

Dentro do Compose, a API usa o host `database` e a porta interna `5432`. O Compose monta a URL com as variáveis da raiz; não lê `BackEnd/.env` para essa configuração.

Os valores dos arquivos `.env.example` são referências de desenvolvimento. Substitua a chave JWT de exemplo por uma chave própria. Para gerar uma:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O serviço de autenticação define a validade dos tokens em `8h`. Não comite arquivos `.env` ou credenciais reais.

## Executar com npm e banco local

Configure `BackEnd/.env` e tenha um PostgreSQL com PostGIS acessível. A migration inicial executa `CREATE EXTENSION IF NOT EXISTS postgis`, portanto o servidor precisa ter a extensão instalada e o usuário precisa poder criá-la. Como alternativa, após configurar o `.env` da raiz, inicie somente o banco do Compose:

```bash
docker compose up -d database
```

O Compose exige `JWT_SECRET` na raiz para resolver sua configuração, mesmo quando o comando seleciona somente o banco.

Na raiz do projeto:

```bash
npm ci
npm exec --workspace=backend -- prisma migrate deploy
npm run dev
```

`migrate deploy` aplica as migrations versionadas ao banco configurado. Confira o destino de `DATABASE_URL` antes de executar. A migration inicial cadastra os perfis `ADMIN`, `GESTOR`, `MOTORISTA` e `SVO`. Para autenticar na API, cadastre um usuário ativo com senha em hash bcrypt e associe os perfis necessários.

## Executar todos os serviços com Docker

Configure o `.env` da raiz e execute:

```bash
docker compose up --build
```

Para executar em segundo plano:

```bash
docker compose up --build -d
```

Depois que o banco e a API estiverem disponíveis, aplique as migrations versionadas:

```bash
docker compose exec backend npx prisma migrate deploy
```

Comandos de acompanhamento:

```bash
docker compose logs -f
docker compose down
```

O Compose inicia `database`, `backend` e `frontend`. O banco usa a imagem PostGIS configurada em `docker-compose.yml` e mantém os dados no volume `postgres_data`. O front-end é compilado e servido pelo Nginx; mudanças no código exigem reconstruir a imagem. Para recarregamento durante o desenvolvimento, use npm.

## Prisma

O cliente é gerado no `postinstall` do back-end durante a instalação. Após alterar o schema, pare a API e regenere o cliente pela raiz:

```bash
npm run prisma:generate --workspace=backend
```

Para criar uma migration durante o desenvolvimento, com o banco de desenvolvimento configurado:

```bash
npm run prisma:migrate --workspace=backend
```

Versione o schema e a migration resultante. O schema está em `BackEnd/prisma/schema.prisma`, as migrations em `BackEnd/prisma/migrations` e a configuração em `BackEnd/prisma.config.ts`.

## Endereços e problemas comuns

| Situação | O que conferir |
| --- | --- |
| Interface | `http://localhost:5173`, ou a porta indicada pelo Vite/Compose. |
| API | `http://localhost:3000/health`, ajustando a porta se necessário. Essa rota não verifica o banco. |
| Porta ocupada no front-end | O Vite pode escolher outra porta; leia o endereço no terminal. |
| Falha de conexão com o banco | Host, porta, credenciais, banco disponível e `DATABASE_URL`. |
| Falha no login da API | Usuário ativo, hash bcrypt, migrations e `JWT_SECRET`; veja [Back-end](BACKEND.md). |
| Erro ao gerar Prisma no Windows | Pare a API antes de regenerar o cliente para liberar os arquivos em uso. |

Consulte [Front-end](FRONTEND.md) para entender as telas e os componentes. Os testes usam mocks do banco e podem ser executados sem PostgreSQL ou Docker; veja [Testes](TESTES.md).
