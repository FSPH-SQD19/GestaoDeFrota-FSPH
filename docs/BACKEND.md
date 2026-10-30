# Desenvolvimento back-end

[Índice da documentação](README.md)

Guia da API Express com TypeScript, Prisma, PostgreSQL, validação Zod e autenticação JWT. Em HML, configure a conexão Neon em `DATABASE_URL`. Os caminhos desta página são relativos à raiz do projeto.

## Organização

```text
BackEnd/
├── src/
│   ├── app.ts          Configuração do Express, rotas e tratamento de erros
│   ├── server.ts       Inicialização do servidor HTTP
│   ├── routes/         Endpoints e aplicação dos middlewares
│   ├── controller/     Entradas HTTP e respostas
│   ├── service/        Validações e regras dos serviços
│   ├── middleware/     JWT, perfis e erros HTTP
│   └── lib/prisma.ts   Instância compartilhada do Prisma
├── prisma/             Schema e migrations
├── tests/              Testes com persistência simulada
└── prisma.config.ts    Caminhos e configuração do Prisma
```

O fluxo das rotas de veículos é: rota → autenticação e perfil → controller → serviço → Prisma. O middleware de erros formata as falhas. `app.ts` exporta a aplicação para uso nos testes; `server.ts` abre a porta HTTP.

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

O serviço exige usuário existente e ativo, compara a senha com bcrypt e assina um JWT com validade fixa de oito horas. A chave é gerada automaticamente em `BackEnd/.runtime/auth.key`, ignorada pelo Git, e reutilizada após reinícios. No Docker, ela fica no volume persistente `backend_auth`. A resposta contém `token` e `usuario`, com `id`, `nome`, `email` e `perfis`; não inclui o hash da senha.

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

## Relatório operacional

`GET /api/v1/relatorios?inicio=2026-10-01&fim=2026-10-30` exige JWT e perfil `ADMIN` ou `GESTOR`. Datas devem ser válidas no formato `YYYY-MM-DD`, com início anterior ou igual ao fim. O intervalo inclui todo o dia final, no fuso UTC-03:00.

- Viagens concluídas: execuções com `dataHoraFim` no período.
- Quilometragem: soma de `kmFinal - kmInicial` dessas execuções; registros sem ambos os odômetros ou com diferença negativa não entram na soma nem na média.
- Km médio por veículo: quilometragem dividida pelas execuções com odômetros válidos daquele veículo.
- Litros abastecidos: soma dos abastecimentos pela própria `dataHora`, incluindo veículos sem viagem no período. Abastecimento não equivale a consumo por viagem.
- Viagens em aberto: solicitações pendentes, aprovadas ou em trânsito cuja saída pretendida está no período. Não representa um saldo histórico.
- Motoristas: contagem das execuções encerradas, agrupadas pelo identificador do motorista.

Desvios de rota e consumo por viagem retornam `null`, pois não há registros suficientes para esses cálculos. Ordens de coleta SVO não têm odômetros nem data de encerramento no schema atual e não entram na contagem de viagens. A quilometragem não equivale ao odômetro acumulado do veículo. Sem registros, o endpoint retorna listas vazias e somas iguais a zero.

## Cadastro de motorista com conta de acesso

Nesta branch, o `POST /api/v1/motoristas` (também disponível no alias `/motoristas`) cadastra a conta e o motorista na mesma transação, como já implementado pela branch antes desta revisão. O corpo contém `nome`, `email`, `senha`, `telefone`, `cpf`, `numeroCnh`, `categoriaCnh` e `validadeCnh`. O perfil MOTORISTA deve existir no banco. A senha é armazenada somente como hash bcrypt; o nome, o e-mail e o identificador da conta são os únicos campos de usuário incluídos na resposta do motorista.

O CPF é validado e normalizado; a CNH exige 11 dígitos; o telefone exige DDD e 8 ou 9 dígitos; o e-mail é normalizado para minúsculas. A senha segue o mínimo de 4 caracteres já definido pela branch, com rejeição acima de 72 bytes para evitar truncamento do bcrypt. A validade da CNH usa o validador compartilhado e aceita o dia atual até o fim do dia em America/Sao_Paulo. Cadastro duplicado retorna 409, inclusive quando detectado antes da transação. Erros de validação retornam 400; falhas internas mantêm mensagens genéricas.

A revisão preserva auditoria com o usuário responsável e os endpoints de atualização e inativação da master. A auditoria de cadastro recebe os dados públicos do motorista, sem senha nem hash. Uma falha da auditoria é registrada no servidor e não converte uma criação já concluída em erro. Nenhum endpoint ou migration novo foi criado.

## Aprovação e recusa de solicitações

Esta branch já implementa `PATCH /solicitacoes/:id/aprovar` e `PATCH /solicitacoes/:id/recusar`. A revisão conecta essas mesmas rotas também ao prefixo canônico `/api/v1/solicitacoes`, preservando o alias original. Administradores e gestores podem decidir; listagem e criação mantêm a permissão dos perfis SOLICITANTE, GESTOR e ADMIN.

A aprovação recebe UUIDs `veiculoId` e `motoristaId`. Exige solicitação pendente, saída e retorno previstos válidos, veículo administrativo ativo e disponível com capacidade suficiente, motorista ativo e disponível e CNH válida até a data do retorno em America/Sao_Paulo. O serviço verifica sobreposição de intervalos em viagens aprovadas ou em trânsito; horários adjacentes não conflitam.

As travas transacionais por recurso são obtidas em ordem fixa, seguidas da trava da solicitação. A consulta das travas retorna um inteiro para evitar desserializar o tipo void no Prisma. A decisão usa atualização condicional do status PENDENTE e auditoria na mesma transação. A recusa recebe `motivoRecusa` não vazio com até 2000 caracteres e também usa atualização condicional e auditoria. Ausência retorna 404; decisão já processada, conflito de alocação e concorrência conhecida retornam 409; recursos ou intervalo inválidos retornam 422; dados inválidos retornam 400.

As regras e respostas são cobertas por testes HTTP com Prisma simulado. O teste de concorrência com PostgreSQL real não foi executado nesta sessão, pois o daemon Docker local está indisponível.
