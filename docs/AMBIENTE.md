# Ambiente de desenvolvimento e homologação

[Índice da documentação](README.md)

O desenvolvimento e a homologação (HML) usam Neon PostgreSQL com PostGIS, em bancos ou branches separados. Para consultar os comandos npm, veja [Início](INICIO.md).

## Pré-requisitos

- Git.
- Node.js compatível com `engines` do `package.json`: `^22.12.0 || ^24.0.0 || >=26.0.0`. O CI usa a linha 24; os Dockerfiles usam a linha 22.
- npm, com instalação das dependências pela raiz usando `npm ci`.
- Projeto Neon com banco ou branch exclusivo para desenvolvimento, separado de HML.
- Docker Desktop ou Docker Engine com Compose apenas se quiser executar a API e a interface em contêineres.

Para clonar o projeto:

```bash
git clone https://github.com/fel1pemsc/GestaoDeFrota-FSPH.git
cd GestaoDeFrota-FSPH
```

## Arquivos de ambiente

| Arquivo local   | Modelo                  | Quem utiliza                                  |
| --------------- | ----------------------- | --------------------------------------------- |
| `.env` na raiz  | `.env.example`          | Portas do Docker Compose de desenvolvimento.  |
| `BackEnd/.env`  | `BackEnd/.env.example`  | API e Prisma, localmente e no Docker Compose. |
| `FrontEnd/.env` | `FrontEnd/.env.example` | URL da API no Vite (`VITE_API_URL`).          |

Crie os arquivos locais a partir dos modelos apenas se ainda não existirem:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path BackEnd/.env)) { Copy-Item BackEnd/.env.example BackEnd/.env }
if (!(Test-Path FrontEnd/.env)) { Copy-Item FrontEnd/.env.example FrontEnd/.env }
```

Os arquivos `.env` são ignorados pelo Git. Não versione credenciais reais.

## Desenvolvimento local

No painel Neon, selecione ou crie um banco/branch de desenvolvimento e copie sua connection string em **Connect**. Use a conexão direta (pooling desativado) como `DATABASE_URL` em `BackEnd/.env`, preservando os parâmetros de SSL fornecidos pelo Neon. O modelo `BackEnd/.env.example` contém apenas valores ilustrativos.

A API local e o Docker Compose leem o mesmo `BackEnd/.env`. Não é necessário iniciar PostgreSQL no computador. O `.env` da raiz configura apenas `BACKEND_PORT` (padrão `3000`) e `FRONTEND_PORT` (padrão `5173`) no Compose.

| Variável em `BackEnd/.env` | Finalidade                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Conexão Neon usada pela API e, por padrão, pelo Prisma.                                               |
| `DIRECT_URL`               | Opcional: conexão direta do mesmo banco para o Prisma, quando a API usa uma URL com pooling.          |
| `SHADOW_DATABASE_URL`      | Opcional: banco separado e descartável para `prisma migrate dev`, caso a role não possa criar bancos. |
| `PORT`                     | Porta da API local (padrão `3000`; no Compose, porta interna `3000`).                                 |

A URL de shadow nunca deve apontar para o banco da aplicação ou de HML: o Prisma pode apagar seu conteúdo durante a criação de migrations. Para aplicar migrations já versionadas com `migrate deploy`, não é necessário banco shadow.

O arquivo `FrontEnd/.env` define `VITE_API_URL` (padrão `http://localhost:3000`) para o cliente Axios em `FrontEnd/src/services/api.ts`. Sem o arquivo, o front-end usa o mesmo endereço padrão.

Após configurar a conexão de desenvolvimento, instale as dependências, aplique as migrations e inicie a API e a interface:

```bash
npm ci
npm exec --workspace=backend -- prisma migrate deploy
npm run dev
```

A migration inicial habilita PostGIS com `CREATE EXTENSION IF NOT EXISTS postgis`; a role Neon precisa ter permissão para executar esse comando.

Para iniciar a API e a interface em contêineres, usando o mesmo banco Neon:

```bash
docker compose up --build -d
docker compose exec backend npx prisma migrate deploy
```

Para criar uma migration, use apenas o banco/branch de desenvolvimento:

```bash
npm run prisma:migrate --workspace=backend -- --name nome_da_alteracao
```

O Compose não gerencia mais um banco local. Volumes existentes de instalações anteriores continuam no Docker; os comandos acima não transferem dados do banco antigo para o Neon.

## Homologação com Neon

Configure `DATABASE_URL` como variável secreta no ambiente de HML, apontando para seu banco/branch exclusivo. Se usar pooling, configure também `DIRECT_URL` com a conexão direta desse mesmo banco. Não reutilize as URLs de desenvolvimento nem versione credenciais.

Para aplicar migrations versionadas em HML, execute no ambiente de deploy:

```bash
npm exec --workspace=backend -- prisma migrate deploy
```

Confira o destino de `DIRECT_URL` (quando definida) ou `DATABASE_URL` antes de executar. Reserve `migrate dev` para o banco/branch de desenvolvimento.

Referências: [Prisma com Neon](https://neon.com/docs/guides/prisma), [PostGIS no Neon](https://neon.com/docs/extensions/postgis) e [shadow database no Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-migrate/understanding-prisma-migrate/shadow-database).

## Prisma e autenticação

O cliente Prisma é gerado no `postinstall` do back-end durante a instalação. Após alterar o schema, pare a API e regenere o cliente:

```bash
npm run prisma:generate --workspace=backend
```

O schema está em `BackEnd/prisma/schema.prisma`, as migrations em `BackEnd/prisma/migrations` e a configuração em `BackEnd/prisma.config.ts`.

Em desenvolvimento, a API gera uma chave aleatória em `BackEnd/.runtime/auth.key` e a reutiliza nos reinícios; no Docker de desenvolvimento, o volume `backend_auth` preserva esse arquivo. Os arquivos `.runtime` não são versionados.

No servidor Node em produção, defina `JWT_SECRET` como segredo de implantação com 128 caracteres hexadecimais aleatórios. Todas as réplicas do mesmo ambiente devem usar a mesma chave. A API recusa iniciar em produção sem esse segredo; a chave local é apenas uma conveniência de desenvolvimento. Gere uma chave com:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Configure também:

- `APP_ORIGINS`: origens exatas da interface, separadas por vírgula, sem barra final. Obrigatória no servidor Node em produção e limitada a HTTPS; em desenvolvimento, os padrões são localhost/127.0.0.1 nas portas 5173 e 4173. Com portas personalizadas no Compose, ajuste esta variável.
- `JWT_ISSUER` e `JWT_AUDIENCE`: identificadores do ambiente. Os padrões são `fsph-frota-api` e `fsph-frota-web`; use valores distintos em desenvolvimento e HML.
- `TRUST_PROXY_HOPS`: opcional, número exato de proxies confiáveis. Sem configuração, a API usa o IP da conexão. Não habilite sem conhecer a topologia; um proxy mal configurado pode permitir falsificação do IP usado no limite de login.

A interface e a API devem ser servidas pelo mesmo site (por exemplo, `frota.exemplo.org` e `api.exemplo.org`) ou por um proxy no mesmo domínio. Cookies `SameSite=Lax` não atendem a uma implantação em sites diferentes. Em produção, use HTTPS, inclusive no proxy público.

A sessão é enviada em cookie `HttpOnly`, `SameSite=Lax`, com `Secure` e prefixo `__Host-` em produção. O JWT não é retornado no JSON do login nem salvo no localStorage. Ao abrir a interface, ela consulta `/api/v1/auth/sessao`; o token CSRF fica apenas em memória. Chamadas de alteração usam `X-CSRF-Token`, obtido em `/api/v1/auth/csrf`.

O navegador encerra a interface após 30 minutos sem interação do usuário e chama o logout para revogar a sessão. O horário de atividade é compartilhado entre abas e preservado ao recarregar; ao voltar de suspensão ou reabrir a interface, o prazo é conferido novamente. Não há gravação de atividade a cada requisição no banco. Se estiver offline, a interface bloqueia o acesso local e tenta revogar a sessão quando a conexão retornar. O Neon mantém o registro revogável da sessão; o JWT conserva o limite absoluto de oito horas. O logout revoga a sessão no banco. A cada requisição, a API consulta usuário ativo, perfis atuais e a versão da senha; mudança de senha invalida as sessões anteriores. Tokens antigos, sem registro de sessão ou com validação incompatível, exigem novo login.

O login tem limites compartilhados entre réplicas: 30 tentativas por IP e 10 por conta a cada 15 minutos, com resposta 429 e `Retry-After`. Os identificadores dos limites são hashes SHA-256, sem armazenar e-mail/IP em texto nessa tabela. As novas senhas exigem pelo menos 6 caracteres e no máximo 72 bytes UTF-8 (limite do bcrypt); contas legadas continuam podendo entrar com sua senha existente.

Para manutenção periódica, remova registros expirados de `auth_sessoes` e `auth_login_limites`; os índices de `expira_em` dão suporte à limpeza. Não remova sessões vigentes. Trocar `JWT_SECRET` ou apagar a chave de desenvolvimento invalida os tokens existentes.

## Endereços e problemas comuns

| Situação                        | O que conferir                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interface                       | `http://localhost:5173`, ou a porta indicada pelo Vite/Compose.                                         |
| API                             | `http://localhost:3000/health`, ajustando a porta se necessário. Essa rota não verifica o banco.        |
| Falha na conexão Neon           | `DATABASE_URL`, credenciais, SSL, acesso à rede e banco/branch selecionado.                             |
| Falha nas migrations            | `DIRECT_URL` ou `DATABASE_URL`, permissões de PostGIS e shadow database para `migrate dev`.             |
| Falha no login da API           | Usuário ativo, hash bcrypt, migrations e acesso ao arquivo local da chave; veja [Back-end](BACKEND.md). |
| Erro ao gerar Prisma no Windows | Pare a API antes de regenerar o cliente para liberar os arquivos em uso.                                |

Consulte [Front-end](FRONTEND.md) para entender as telas. Os testes usam mocks do banco e podem ser executados sem conexão ao Neon ou Docker; veja [Testes](TESTES.md).

## Dados de demonstração

Para popular o banco de desenvolvimento configurado em `BackEnd/.env` com todos os perfis e cenários fictícios:

```bash
npm run seed:demo --workspace=backend
```

O comando cria contas ADMIN, GESTOR, MOTORISTA, SVO e SOLICITANTE, com três motoristas, frota administrativa/SVO, fornecedores, documentos, viagens em diferentes estados, abastecimentos, manutenções, chamados, ordens e desinfecções. Nomes e dados operacionais são identificados como DEMO; não representam pessoas ou operações reais.

As contas usam e-mails `@demo.frota.test`. A senha aleatória comum é salva em `BackEnd/.runtime/demo-access.json`, ignorado pelo Git. O comando pode ser reexecutado: usa identificadores estáveis, preserva registros existentes e não redefine senhas. Preserve o arquivo de acessos para reutilizar essas credenciais. O seed normal (`npm run seed --workspace=backend`) continua criando apenas os perfis.

O seed usa a data corrente de America/Sao_Paulo como referência; `SEED_DEMO_DATE=AAAA-MM-DD` permite uma data fixa. O comando recusa execução com `NODE_ENV=production`. Ele não apaga os dados existentes e executa a inserção em uma transação.

## CD de homologação na Cloudflare

A branch `hml` já publica interface e API no mesmo Worker (`gestao-frota-hml`), pelo workflow `.github/workflows/cd-hml.yml`. A configuração de HML usa o binding `HYPERDRIVE` existente em `wrangler.jsonc`; o banco não é recriado. Nesta branch, o CD só é disparado após o código chegar à `hml`.

O Prisma usa o mesmo schema e o adaptador PostgreSQL (`@prisma/adapter-pg`) nos dois ambientes. No Node local, reutiliza o pool configurado por `DATABASE_URL`; no Worker, cada requisição cria seu cliente a partir de `HYPERDRIVE.connectionString` e encerra esse cliente ao terminar. As transações de negócio continuam no mesmo banco.

Configure estes secrets no environment `hml` do GitHub:

- `CLOUDFLARE_ACCOUNT_ID`: pode ser um secret ou uma variável (`Variables`) do environment `hml` ou do repositório. O workflow prioriza o secret quando ambos existem.
- `CLOUDFLARE_API_TOKEN`: secret com permissão para publicar Workers/secrets e consultar/editar a configuração Hyperdrive.
- `DATABASE_URL_MIGRATIONS`: conexão direta ao mesmo host/branch e database do Hyperdrive. O CD compara os destinos antes de executar migrations; URLs Neon com `-pooler` são reconhecidas como o mesmo endpoint.
- `JWT_SECRET`: 128 caracteres hexadecimais aleatórios, compartilhados entre as requisições/instâncias de HML.

O CD executa formatação, lint, testes, build e empacotamento do Worker; confere o destino do banco; desativa o cache de consultas Hyperdrive; aplica `prisma migrate deploy`; e publica o Worker com a chave JWT. A desativação do cache é necessária para que logout, bloqueios e permissões sejam observados nas consultas seguintes. O script não altera as credenciais nem a origem do Hyperdrive.

No Worker, a origem HTTPS da própria requisição é permitida para a interface e os cookies usam `Secure` e prefixo `__Host-`. `APP_ORIGINS` só é necessária para permitir origens adicionais. `JWT_ISSUER` e `JWT_AUDIENCE` são definidos para HML no Wrangler; secrets e clientes não são compartilhados em variáveis mutáveis entre requisições concorrentes.

O front-end compilado usa a API do mesmo domínio (`/`) por padrão; o Vite local continua usando `http://localhost:3000`. `VITE_API_URL` pode substituir esse destino quando necessário. Em HML, o workflow fixa `/`; as rotas SPA e os aliases da API estão configurados no Wrangler.

Para validar o pacote sem publicar:

```bash
npm run build
npm run cloudflare:check
```

O seed padrão cria somente os perfis. As contas e os dados DEMO são opcionais e exclusivos do banco escolhido; não são executados automaticamente pelo CD. Para HML, execute o seed explicitamente em um terminal com sua `DATABASE_URL` de homologação (o seed de demonstração recusa `NODE_ENV=production`). A chave e o arquivo local de acessos `.runtime` não são enviados à Cloudflare.

### Promoção de código entre branches

O fluxo de promoção é `DevOps → master → hml`. Todas usam a mesma implementação e o mesmo histórico de migrations. O push em `master` não publica HML: o workflow de CD aceita somente `hml`. A diferença entre ambientes está na configuração de execução, não em versões distintas das regras de negócio.

No desenvolvimento, `DATABASE_URL` vem do `.env` local ignorado pelo Git. No Worker, a conexão vem exclusivamente do binding Hyperdrive de HML; uma `DATABASE_URL` local não substitui esse binding. A URL direta de migrations é conferida contra a origem do Hyperdrive antes de qualquer alteração de schema. O deploy não copia usuários, senhas, dados DEMO ou arquivos `.runtime` entre bancos.

Depois de alterar o `.env` local, reinicie a API para inicializar o novo pool. No Worker, a conexão é criada por requisição; a configuração é aplicada no deploy. A troca de ambiente exige login novamente, pois as chaves e os identificadores JWT são próprios de cada ambiente.
