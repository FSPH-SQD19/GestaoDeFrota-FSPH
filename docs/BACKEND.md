# Desenvolvimento back-end

[Índice da documentação](README.md)

Guia da API Express com TypeScript, Prisma, PostgreSQL, validação Zod e autenticação JWT. Localmente, o servidor Node lê `DATABASE_URL`; em HML, o Cloudflare Worker conecta ao Neon pela binding Hyperdrive. Os caminhos desta página são relativos à raiz do projeto.

## Organização

```text
BackEnd/
├── src/
│   ├── app.ts          Configuração do Express, rotas e tratamento de erros
│   ├── server.ts       Inicialização do servidor HTTP
│   ├── worker.ts       Adaptador HTTP para Cloudflare Workers em HML
│   ├── routes/         Endpoints e aplicação dos middlewares
│   ├── controller/     Entradas HTTP e respostas
│   ├── service/        Validações e regras dos serviços
│   ├── middleware/     JWT, perfis e erros HTTP
│   └── lib/prisma.ts   Instância compartilhada do Prisma
├── prisma/             Schema e migrations
├── tests/              Testes com persistência simulada
└── prisma.config.ts    Caminhos e configuração do Prisma
```

O fluxo das rotas de veículos é: rota → autenticação e perfil → controller → serviço → Prisma. O middleware de erros formata as falhas. `app.ts` exporta a aplicação para uso nos testes; `server.ts` abre a porta HTTP no desenvolvimento local. `worker.ts` adapta a mesma aplicação para o runtime Cloudflare e inicializa o Prisma com a connection string fornecida pelo Hyperdrive.

## Endpoints disponíveis

| Método | Caminho                               | Autenticação                | Resultado                                                    |
| ------ | ------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| GET    | `/health`                             | Pública                     | Status do processo da API; não consulta o banco.             |
| POST   | `/auth/login`                         | Pública                     | Login com e-mail e senha.                                    |
| POST   | `/api/v1/auth/login`                  | Pública                     | Alias do mesmo login.                                        |
| GET    | `/auth/perfil`, `/api/v1/auth/perfil` | JWT                         | Identidade autenticada em `{ usuario: { userId, perfis } }`. |
| GET    | `/auth/admin`, `/api/v1/auth/admin`   | JWT com `ADMIN`             | Confirmação de acesso autorizado.                            |
| GET    | `/api/v1/veiculos`                    | JWT com `ADMIN` ou `GESTOR` | Lista paginada de veículos.                                  |
| POST   | `/api/v1/veiculos`                    | JWT com `ADMIN` ou `GESTOR` | Cadastro de veículo.                                         |

## Autenticação

Corpo do login:

```json
{
  "email": "usuario@example.test",
  "senha": "senha-do-usuario-cadastrado"
}
```

O serviço exige usuário existente e ativo, compara a senha com bcryptjs e assina um JWT com validade fixa de oito horas. No Node local, a chave é gerada automaticamente em `BackEnd/.runtime/auth.key`, ignorada pelo Git, e reutilizada após reinícios. No Docker, ela fica no volume persistente `backend_auth`. O Worker usa o secret `JWT_SECRET` configurado no ambiente Cloudflare de HML. A resposta contém `token` e `usuario`, com `id`, `nome`, `email` e `perfis`; não inclui o hash da senha.

Nas rotas protegidas, envie o token recebido no login:

```text
Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN
```

O middleware valida a assinatura, expiração, identificador e perfis do token. Para veículos, pelo menos um dos perfis deve ser `ADMIN` ou `GESTOR`.

Auth e veículos usam `authenticate` e `requireRole` de `http_m.ts`, com identidade interna em `res.locals.usuario` no formato `{ id, perfis }`. `AuthToken` e `autorizarPerfis` são aliases de compatibilidade. As falhas desses middlewares passam por `HttpError` e pelo handler comum, retornando `{ statusCode, message, errors }`.

A migration inicial cadastra os perfis `ADMIN`, `GESTOR`, `MOTORISTA` e `SVO`. Os nomes de perfis enviados pela API e usados pela interface devem seguir um mapeamento consistente.

O login responde `400` para campos obrigatórios inválidos, `401` para credenciais inválidas e `500` para falhas internas. O controller de login usa os formatos `{ "error": "..." }` ou `{ "mensagem": "..." }`.

## Listagem de veículos

Exemplo de consulta:

```text
GET /api/v1/veiculos?page=1&pageSize=10&tipoFrota=SVO&status=DISPONIVEL
```

| Parâmetro     | Regra                                                     |
| ------------- | --------------------------------------------------------- |
| `page`        | Inteiro a partir de 1; padrão 1.                          |
| `pageSize`    | Inteiro entre 1 e 100; padrão 10.                         |
| `tipoFrota`   | `ADMINISTRATIVA` ou `SVO`.                                |
| `status`      | `DISPONIVEL`, `EM_VIAGEM`, `MANUTENCAO` ou `DESINFECCAO`. |
| `propriedade` | `PROPRIO` ou `LOCADO`.                                    |
| `ativo`       | Texto `true` ou `false`; padrão `true`.                   |
| `busca`       | Até 100 caracteres, por placa ou modelo.                  |

A listagem ordena por placa e retorna `{ data, meta }`. Os metadados são `page`, `pageSize`, `total` e `totalPages`. O serviço serializa `odometroAtual` como número.

## Cadastro de veículos

Exemplo de corpo:

```json
{
  "placa": "ABC1D23",
  "modelo": "Fiat Ducato",
  "tipoFrota": "ADMINISTRATIVA",
  "propriedade": "PROPRIO",
  "ano": 2024,
  "combustivel": "Diesel",
  "capacidadeMaxima": 4,
  "odometroAtual": 0,
  "status": "DISPONIVEL"
}
```

| Campo              | Validação                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `placa`            | Obrigatória; normaliza letras para maiúsculas e remove espaços/hífens. Aceita formatos `ABC1234` e `ABC1D23`. |
| `modelo`           | Obrigatório; de 2 a 100 caracteres após remover espaços nas extremidades.                                     |
| `tipoFrota`        | Obrigatório; `ADMINISTRATIVA` ou `SVO`.                                                                       |
| `propriedade`      | `PROPRIO` ou `LOCADO`; padrão `PROPRIO`.                                                                      |
| `fornecedorId`     | UUID opcional; obrigatório para `LOCADO`. Se informado, precisa identificar fornecedor ativo.                 |
| `ano`              | Opcional; inteiro de 1950 até o ano atual mais um.                                                            |
| `combustivel`      | Opcional; de 1 a 30 caracteres após remover espaços nas extremidades.                                         |
| `capacidadeMaxima` | Inteiro de 1 a 50; padrão 4.                                                                                  |
| `odometroAtual`    | Número de 0 a 99999999.99; padrão 0.                                                                          |
| `status`           | Mesmos valores da listagem; padrão `DISPONIVEL`. `DESINFECCAO` é exclusivo de `SVO`.                          |

Placa duplicada retorna `409`; fornecedor ausente do banco ou inativo retorna `422`. O sucesso retorna `201`, o veículo e o header `Location`.

Após salvar, o serviço tenta registrar auditoria com usuário, ação, tabela, identificador e dados novos. Uma falha da auditoria é registrada no console, mas não desfaz o cadastro nem muda a resposta de sucesso.

## Erros das rotas de veículos

```json
{
  "statusCode": 400,
  "message": "Dados inválidos.",
  "errors": [{ "campo": "placa", "mensagem": "Placa inválida." }]
}
```

| Código | Situação                               |
| ------ | -------------------------------------- |
| `400`  | Corpo, filtros ou JSON inválidos.      |
| `401`  | Token ausente, inválido ou expirado.   |
| `403`  | Perfil sem acesso à operação.          |
| `409`  | Placa já cadastrada.                   |
| `422`  | Fornecedor não encontrado ou inativo.  |
| `500`  | Configuração ausente ou falha interna. |

## Desenvolvimento e verificação

Na raiz:

```bash
npm run dev:backend
npm run lint --workspace=backend
npm test --workspace=backend
npm run build --workspace=backend
```

Centralize o acesso ao banco em `BackEnd/src/lib/prisma.ts` e mantenha alterações do schema acompanhadas de migrations. Veja [Ambiente](AMBIENTE.md) para configurar a API e [Testes](TESTES.md) para adicionar cenários.

A API valida o ano do veículo até o ano atual mais um; a constraint da migration limita o banco ao intervalo de 1950 a 2100. Ao alterar validações, confira os dois níveis.
