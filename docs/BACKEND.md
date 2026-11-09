# Desenvolvimento back-end

[Índice da documentação](README.md)

Guia da API Express com TypeScript, Prisma, PostgreSQL, validação Zod e autenticação JWT. Em desenvolvimento e HML, configure a conexão Neon em `DATABASE_URL`, com bancos/branches separados. Os caminhos desta página são relativos à raiz do projeto.

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

| Método | Caminho                                                     | Autenticação                | Resultado                                                      |
| ------ | ----------------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| GET    | `/health`                                                   | Pública                     | Status do processo da API; não consulta o banco.               |
| POST   | `/auth/login`                                               | Pública                     | Login com e-mail e senha.                                      |
| POST   | `/api/v1/auth/login`                                        | Pública                     | Alias do mesmo login.                                          |
| GET    | `/auth/perfil`, `/api/v1/auth/perfil`                       | JWT                         | Identidade autenticada em `{ usuario: { userId, perfis } }`.   |
| GET    | `/auth/admin`, `/api/v1/auth/admin`                         | JWT com `ADMIN`             | Confirmação de acesso autorizado.                              |
| GET    | `/api/v1/usuarios`                                          | JWT com `ADMIN`             | Lista paginada de usuários.                                    |
| GET    | `/api/v1/usuarios/:id`                                      | JWT com `ADMIN`             | Detalhe do usuário (sem hash de senha).                        |
| POST   | `/api/v1/usuarios`                                          | JWT com `ADMIN`             | Cadastro de usuário com perfis e senha inicial.                |
| PATCH  | `/api/v1/usuarios/:id`                                      | JWT com `ADMIN`             | Atualização de dados, setor, telefone, ativo e perfis.         |
| DELETE | `/api/v1/usuarios/:id`                                      | JWT com `ADMIN`             | Inativação (soft delete) e revogação de sessões.               |
| PATCH  | `/api/v1/auth/usuarios/:id/redefinir-senha`                 | JWT com `ADMIN`             | Redefinição administrativa de senha (já existente).            |
| GET    | `/api/v1/veiculos`                                          | JWT com `ADMIN` ou `GESTOR` | Lista paginada de veículos.                                    |
| POST   | `/api/v1/veiculos`                                          | JWT com `ADMIN` ou `GESTOR` | Cadastro de veículo.                                           |
| GET    | `/api/v1/veiculos/:id/documentos`                           | JWT com `ADMIN` ou `GESTOR` | Documentos do veículo com situação calculada.                  |
| POST   | `/api/v1/veiculos/:id/documentos`                           | JWT com `ADMIN` ou `GESTOR` | Cadastro de documento (CRLV, IPVA, seguro ou vistoria).        |
| GET    | `/notificacoes`, `/api/v1/notificacoes`                     | JWT                         | Lista notificações e contador de não lidas do usuário.         |
| PATCH  | `/notificacoes/:id/lida`, `/api/v1/notificacoes/:id/lida`   | JWT                         | Marca uma notificação do usuário autenticado como lida.        |
| PATCH  | `/notificacoes/ler-todas`, `/api/v1/notificacoes/ler-todas` | JWT                         | Marca todas as notificações não lidas do usuário como lidas.   |
| GET    | `/api/v1/multas`                                            | JWT com `ADMIN` ou `GESTOR` | Lista paginada de infrações, totais em R$ e pontos acumulados. |
| GET    | `/api/v1/multas/:id`                                        | JWT com `ADMIN` ou `GESTOR` | Detalhes da infração, dados do auto, veículo e condutor.       |
| POST   | `/api/v1/multas`                                            | JWT com `ADMIN` ou `GESTOR` | Registro de nova infração de trânsito (CTB / FSPH).            |
| PATCH  | `/api/v1/multas/:id`                                        | JWT com `ADMIN` ou `GESTOR` | Atualização de status (PAGA, EM_RECURSO), data de quitação.    |
| GET    | `/api/v1/multas/motorista/:motoristaId`                     | JWT com `ADMIN` ou `GESTOR` | Histórico e somatório de pontos na CNH do condutor.            |

## Autenticação

Corpo do login:

```json
{
  "email": "usuario@example.test",
  "senha": "senha-do-usuario-cadastrado"
}
```

O serviço exige usuário existente e ativo, compara a senha com bcrypt e registra uma sessão no Neon. A resposta contém apenas `usuario`, com `id`, `nome`, `email` e `perfis`. O JWT segue em cookie `HttpOnly`, `SameSite=Lax`, com `Secure` em produção; não é exposto no JSON nem armazenado no localStorage.

Fluxo da interface:

1. `GET /api/v1/auth/csrf`: recebe o token CSRF em JSON e o cookie assinado associado.
2. `POST /api/v1/auth/login`: envia credenciais, cookies e `X-CSRF-Token`; recebe o cookie de sessão.
3. `GET /api/v1/auth/sessao`: restaura a identidade consultando a sessão e o usuário no banco.
4. Antes de alterar dados, obtenha novamente o CSRF após o login: a assinatura é vinculada ao cookie da sessão atual.
5. `POST /api/v1/auth/logout`: com cookies e `X-CSRF-Token`, revoga a sessão no Neon e limpa o cookie.

Os mesmos endpoints existem sob `/auth`. O Axios central envia cookies e CSRF automaticamente. Clientes de API que já tenham o JWT podem usar `Authorization: Bearer ...`; a mesma validação de sessão se aplica. O login não fornece um token Bearer separado.

O middleware exige HS256, emissor, destinatário, identificador de sessão, emissão e expiração. A autorização usa os perfis atuais do banco, não claims de perfil enviados no token. Sessões revogadas, usuários inativos ou senha alterada são rejeitados. O JWT tem limite absoluto de oito horas. A interface controla 30 minutos sem interação com um timer no navegador e chama o logout; o banco não registra nem controla o tempo de inatividade.

A chave local em `.runtime/auth.key` atende ao desenvolvimento. Em produção, `JWT_SECRET` compartilhada entre réplicas é obrigatória; o Node exige `APP_ORIGINS` com HTTPS e o Worker permite a própria origem HTTPS da aplicação; veja [Ambiente](AMBIENTE.md#prisma-e-autenticação).

Auth e veículos usam `authenticate` e `requireRole` de `http_m.ts`, com identidade interna em `res.locals.usuario` no formato `{ id, perfis }`. `AuthToken` e `autorizarPerfis` são aliases de compatibilidade. As falhas desses middlewares passam por `HttpError` e pelo handler comum, retornando `{ statusCode, message, errors }`.

A migration inicial cadastra os perfis `ADMIN`, `GESTOR`, `MOTORISTA` e `SVO`. Os nomes de perfis enviados pela API e usados pela interface devem seguir um mapeamento consistente.

O login responde `400` para campos obrigatórios inválidos, `401` para credenciais inválidas, `403` para falha de CSRF/origem, `429` para excesso de tentativas e `500` para falhas internas.

## Tratamento de erros

As falhas da API Express usam um único formato: `{ statusCode, message, errors }`. O campo `errors` contém os detalhes de validação por campo e fica vazio quando não há detalhes adicionais. Login, motoristas, fornecedores, CSRF e limites de tentativas seguem esse contrato; respostas de sucesso mantêm seus formatos próprios.

- `lib/http_error.ts` define `HttpError`, com status HTTP, mensagem pública e detalhes opcionais. Serviços traduzem erros de persistência quando conhecem o significado de negócio (por exemplo, CNPJ duplicado).
- Controllers validam a entrada e retornam sucesso. Falhas síncronas ou rejeições de handlers assíncronos seguem automaticamente para o middleware pelo Express 5; não é necessário envolver cada controller em `try/catch`.
- `middleware/error_m.ts`, registrado por último no `app.ts`, gera a resposta e registra falhas internas uma única vez. Erros inesperados retornam `500` com mensagem genérica, sem expor stack ou detalhes de infraestrutura. JSON malformado retorna `400` e corpo acima de 512 KB retorna `413`.
- Proteções de acesso encaminham `HttpError` ao mesmo middleware. Limites de tentativas preservam o cabeçalho `Retry-After`.

Mensagens públicas devem orientar a pessoa sobre o próximo passo, sem expor códigos internos ou termos de implementação. `lib/validar.ts` mantém os detalhes por campo e fornece mensagens em português quando o schema não define uma orientação própria. Identificadores e formatos técnicos continuam sendo validados internamente.

Tratamentos locais permanecem quando recuperam uma operação ou isolam falhas secundárias, como notificações. O fallback `503` do Worker permanece fora do Express, pois também cobre falhas antes da inicialização da aplicação.

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

## Documentos do veículo

Controle de CRLV/licenciamento, IPVA, seguro e vistoria (RF010-DOC, RB01). Corpo do cadastro:

```json
{ "tipoDocumento": "CRLV", "dataVencimento": "2027-03-31" }
```

`tipoDocumento` aceita `CRLV`, `IPVA`, `SEGURO` ou `VISTORIA`; `dataVencimento` usa `AAAA-MM-DD`, entre 2000 e 2100. Documento já vencido pode ser cadastrado. Renovar é cadastrar um novo documento do mesmo tipo: por tipo, vale o de maior vencimento e o histórico é mantido. Mesmo tipo com o mesmo vencimento retorna `409`; veículo inexistente `404`; veículo inativo `422`. A migration `20261108180000_documentos_vistoria` inclui `VISTORIA` na constraint do banco.

A situação é calculada a cada consulta no dia de America/Sao_Paulo: `VENCIDO` depois da data de vencimento, `PROXIMO_VENCIMENTO` a partir de 90 dias antes (inclusive o próprio dia) e `VIGENTE` antes disso. A coluna `status` guarda só a situação no momento do cadastro.

A listagem retorna `{ data, resumo }`. Cada item traz `tipoDocumento`, `dataVencimento`, `situacao`, `diasParaVencer` (negativo quando vencido) e `atual` (se é o documento que vale para o tipo). O `resumo` traz `situacaoGeral` (a pior entre os documentos atuais, ou `null` sem documentos), `bloqueiaAlocacao` e `tiposSemRegistro`.

O resumo do painel (`GET /api/v1/dashboard/resumo`, perfis `ADMIN` e `GESTOR`) inclui `alertas`: documentos atuais dos veículos ativos com situação `VENCIDO` ou `PROXIMO_VENCIMENTO`, com os mesmos campos da listagem e a `placa` do veículo. A ordenação prioriza o menor `diasParaVencer`. Documentos substituídos por renovação não geram alertas.

A aprovação de solicitação (`PATCH .../aprovar`) recusa com `422` o veículo cujo documento atual de algum tipo vence antes do dia do retorno previsto (ou antes de hoje). Cada documento pendente vem em `errors`, com `campo: "veiculoId"`. Veículo sem documento cadastrado não é bloqueado.

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

## Gestão de usuários

`GET|POST|PATCH|DELETE /api/v1/usuarios` exige JWT com perfil `ADMIN`. A migration `20261104120000_usuarios_telefone_setor` adiciona `telefone` e `setor` em `usuarios`.

- `GET /api/v1/usuarios`: query `page`, `pageSize` (padrão 20, máx. 100), `busca`, `setor`, `perfil`, `ativo`. Resposta `{ data, meta }`; cada item traz `perfis` como nomes (`ADMIN`, `GESTOR`, `MOTORISTA`, `SVO`, `SOLICITANTE`). A ordenação é por nome, com desempate por ID para manter a paginação estável entre homônimos.
- `GET /api/v1/usuarios/:id`: detalhe sem `senhaHash`.
- `POST /api/v1/usuarios`: `{ nome, email, senha, perfis[], telefone?, setor? }` → `201` + `Location` + `{ mensagem, dados }`. Senha mínima de 8 caracteres (mesmo critério da redefinição administrativa).
- `PATCH /api/v1/usuarios/:id`: campos opcionais `nome`, `email`, `telefone`, `setor`, `ativo`, `perfis` → `{ mensagem, dados }`.
- `DELETE /api/v1/usuarios/:id`: inativa (`ativo=false`), revoga sessões e retorna `{ mensagem, dados }`.

E-mail é normalizado para minúsculas e permanece único (`409` se duplicado). Telefone, quando informado, exige DDD e 8 ou 9 dígitos. O administrador não pode inativar a própria conta nem remover o próprio perfil `ADMIN`. Atribuição do perfil `MOTORISTA` não cria o cadastro operacional de motorista — use `POST /api/v1/motoristas`. Redefinição de senha permanece em `PATCH /api/v1/auth/usuarios/:id/redefinir-senha`.

No PATCH, omitir `telefone` preserva o contato; `null` ou texto em branco limpa o campo. Valores preenchidos sem dígitos retornam `400` sem gravar alterações. Tanto `PATCH` com `ativo=false` quanto `DELETE` revogam as sessões na mesma transação da inativação, inclusive ao repetir a operação.

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

### Manutenções

As rotas existentes exigem autenticação e perfil `ADMIN` ou `GESTOR`:

- `GET /api/v1/manutencoes`: paginação e filtros por veículo, tipo, status e intervalo de datas.
- `POST /api/v1/manutencoes`: registra preventiva concluída ou corretiva aberta. Exige veículo ativo e fornecedor ativo quando informado.
- `PATCH /api/v1/manutencoes/:id/concluir`: conclui apenas registros abertos, com atualização condicional e auditoria na mesma transação.

Datas aceitam `AAAA-MM-DD` ou datetime ISO com fuso; o dia informado é preservado, sem horário, conforme a coluna `DATE`. Valores nulos, booleanos, números e datas inexistentes são rejeitados. Custos devem ser positivos e valores monetários e de odômetro aceitam até duas casas decimais.

Cadastro e conclusão compartilham a trava por veículo com a aprovação de solicitações. A conclusão libera apenas veículos ativos ainda em `MANUTENCAO`, sem outras manutenções abertas, e retorna o status efetivamente persistido. Operações repetidas não duplicam a conclusão ou a auditoria. Disputas transacionais recuperáveis retornam `409`.

A migration de status já pertencente à branch foi preservada e não foi aplicada ao banco nesta revisão. Ela define `ABERTA` como padrão também para registros antigos: antes de implantação em uma base com histórico, os responsáveis devem conferir a classificação desses registros. Os testes HTTP usam persistência simulada; a concorrência em PostgreSQL real permanece sem validação nesta sessão.

### Operação SVO

As rotas em `/api/v1/svo` exigem perfil `SVO` ou `ADMIN`. IDs são UUIDs. Consultas: `GET /indicadores`, `/chamados` (paginação, busca e filtro `etapa`), `/viaturas` e `/motoristas`. Atendimento: `POST /chamados` e `PATCH /chamados/:id/triagem`.

| Método e caminho (prefixo `/api/v1/svo`) | Corpo                                                           | Resultado                                                                       |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /ordens-coleta`                    | `{ chamadoId, veiculoId, motoristaId, numeroDeclaracaoObito? }` | `201`, ordem em `AGUARDANDO_DESPACHO`; chamado deve estar aprovado e sem ordem. |
| `PATCH /ordens-coleta/:id/etapa`         | `{ status: "EM_DESLOCAMENTO" \| "NO_LOCAL" \| "ENTREGUE_SVO" }` | `200`, ordem atualizada; `:id` identifica a ordem, não o chamado.               |
| `PATCH /ordens-coleta/:id/cancelar`      | Sem corpo                                                       | `200`, ordem em `CANCELADA`; permitido somente antes do despacho.               |
| `PATCH /viaturas/:id/desinfeccao`        | Sem corpo                                                       | `200`, viatura liberada após confirmar desinfecção.                             |

A sequência obrigatória é `AGUARDANDO_DESPACHO → EM_DESLOCAMENTO → NO_LOCAL → ENTREGUE_SVO`. O servidor registra respectivamente `dataHoraSaida`, `dataHoraChegadaLocal` e `dataHoraEntregaSvo`; todos começam nulos e são retornados na ordem e na listagem dos chamados. Datas são ISO 8601. Repetir ou pular etapa retorna `409`, sem alterar horários ou duplicar auditoria. Corpo ou UUID inválido retorna `400`; registro ausente, `404`; recursos indisponíveis ou CNH vencida, `422`; falta de sessão, `401`; perfil sem acesso, `403`.

Na emissão, a ordem reserva uma vaga e ocupa o motorista, mas mantém a viatura disponível até registrar a saída. Reservas contam para capacidade, vínculo do condutor e filtro `EM_OPERACAO`, mas não para `coletasEmAndamento`. O painel distingue a reserva da coleta em trânsito. No despacho, a viatura e a habilitação do motorista são revalidadas. Cancelar mantém a ordem no histórico e no filtro `ENCERRADO`, libera sua vaga e libera o motorista se não houver outras ordens ativas. O chamado cancelado não admite nova emissão (uma ordem por chamado). Cancelamento antes de qualquer saída não gera desinfecção.

Compatibilidade: `POST /chamados/:id/ordens` aceita a alocação sem `chamadoId` e também cria uma reserva, sem despacho automático. `PATCH /chamados/:id/concluir` executa a mesma entrega das novas rotas, exigindo `NO_LOCAL` e retornando `ENTREGUE_SVO`. Ordens legadas em `EM_ANDAMENTO` devem registrar `NO_LOCAL` antes da entrega. Ordens já `CONCLUIDA` permanecem encerradas. A interface usa `/ordens-coleta` e os botões de saída, chegada, entrega e cancelamento.

Os testes HTTP verificam autenticação, autorização e validação. Uma suíte adicional exercita Express, controladores e serviços reais com persistência simulada ao longo do atendimento, reserva, despacho, chegada, entrega, desinfecção e cancelamento; o Playwright percorre a tela em desktop e celular com HTTP simulado.

Emissão e conclusão serializam os recursos na ordem motorista, veículo e chamado, compartilhando as chaves de trava com aprovação de solicitações e manutenção. A conclusão relê a ordem depois das travas para rejeitar repetição sem duplicar auditoria ou desinfecção. O motorista não pode operar duas viaturas ao mesmo tempo, e coletas simultâneas na mesma viatura mantêm o condutor existente. A capacidade, a CNH e os estados operacionais são conferidos antes do despacho.

A última coleta encaminha a viatura à desinfecção sem sobrescrever outros estados operacionais. A liberação do condutor é condicional ao cadastro ativo e ao status ocupado. A confirmação da desinfecção exige ausência de coletas ativas. Atualizações de status e auditoria permanecem na mesma transação; disputas transacionais ou emissão duplicada retornam `409`. Concorrência em PostgreSQL real não foi validada nesta revisão.

### Escalas e plantões do SVO

Atende a RF014-SVO (S19FROTA-249). Cada escala vincula um motorista a uma viatura SVO em um turno (`inicioTurno` e `fimTurno`, ISO 8601 com fuso, até 24 horas). Pela ATA, não há vínculo fixo entre motorista e viatura: a mesma viatura pode ter mais de um motorista no turno.

- `POST /api/v1/svo/escalas`: `{ motoristaId, veiculoId, inicioTurno, fimTurno, observacoes? }` (observações até 300 caracteres). Retorna `201`. Erros: `400` validação, `422` turno já terminado, motorista inativo, CNH vencendo antes do fim do turno ou viatura que não seja SVO ativa, `409` motorista com outra escala no mesmo horário.
- `GET /api/v1/svo/escalas`: filtros `situacao` (`AGENDADA`, `EM_ANDAMENTO`, `SUSPENSA` ou `ENCERRADA`), `motoristaId`, `veiculoId`, `page` e `pageSize` (padrão 20, até 100). Resposta `{ data, meta }`; cada item traz `motorista { id, nome, telefone, ativo }`, `veiculo { id, placa, modelo, status, ativo }`, horários, `encerradaEm` e `situacao`. `AGENDADA`, `EM_ANDAMENTO` e `SUSPENSA` vêm em ordem cronológica; o restante, da mais recente para a mais antiga.
- `PATCH /api/v1/svo/escalas/:id/encerrar`: grava `encerradaEm`. Encerrar antes do início cancela a escala e libera o horário do motorista. `404` inexistente, `409` já encerrada.

A situação é calculada a cada consulta. Se o motorista ou a viatura forem inativados depois do cadastro, a escala ainda não terminada fica `SUSPENSA`: sai de `AGENDADA` e `EM_ANDAMENTO` (o plantão atual só mostra recursos ativos), pode ser encerrada e volta sozinha à situação anterior se o recurso for reativado. Para reescalar o motorista no mesmo horário, encerre antes a escala suspensa. O cadastro usa a mesma trava por motorista da emissão de ordens SVO. Cadastro e encerramento geram auditoria na mesma transação, sem copiar as observações. A emissão da ordem de coleta não consulta a escala: o painel destaca os recursos em plantão, sem bloquear despacho.

### Abastecimentos e Cartão Rede Prime

Atende a S19FROTA-242. O Cartão Corporativo Rede Prime vale em vários postos credenciados, sem fornecedor fixo por CNPJ: o campo opcional `postoCredenciado` (texto até 150 caracteres; vazio ou só espaços vira `null`) registra o posto, e `fornecedorId` continua opcional.

- `POST /api/v1/abastecimentos` (`ADMIN`, `GESTOR` ou `MOTORISTA`): `{ veiculoId, motoristaId?, fornecedorId?, dataHora?, odometro, litros, valorTotal, postoCredenciado? }`. Retorna `201`.
- Para quem só tem `MOTORISTA`, o motorista é sempre o vinculado ao usuário logado (`motoristaId` e `dataHora` do corpo são ignorados; vale a hora do servidor) e o veículo precisa estar em execução com ele: viagem `EM_TRANSITO` em que está alocado ou ordem de coleta SVO em `EM_DESLOCAMENTO`, `NO_LOCAL` ou `EM_ANDAMENTO`. `veiculoId` é opcional quando há um único veículo em execução. Erros: `403` usuário sem motorista ativo vinculado, `422` sem viagem/coleta em andamento, veículo fora dela ou mais de um veículo sem `veiculoId` informado. As validações de odômetro e a auditoria são as mesmas do cadastro pela gestão.
- `GET /api/v1/abastecimentos` (`ADMIN` ou `GESTOR`): aceita também o filtro `motoristaId`; cada item traz `postoCredenciado`.
- `GET /api/v1/abastecimentos/meus` (`MOTORISTA`): mesmos filtros, formato e paginação, restrito aos lançamentos do motorista logado.

### Compatibilidade com Cloudflare

`worker.ts` adapta o Express ao runtime Cloudflare. O cliente Prisma, a chave de assinatura, o IP e a origem da requisição ficam em um contexto isolado; cada chamada usa seu próprio pool, encerrado com `waitUntil`. No servidor Node, `server.ts` inicializa a conexão local. O schema usa `engineType = "client"` e o adaptador PostgreSQL em ambos os ambientes; `bcryptjs` mantém compatibilidade com os hashes bcrypt já existentes no Neon.

O limite de login usa `CF-Connecting-IP` recebido pelo Worker; no Node, usa o IP da conexão ou o proxy explicitamente configurado. O CD mantém o cache Hyperdrive desativado para evitar reutilizar consultas de sessões, usuários ou permissões após alterações.

### Central de notificações

As rotas `/api/v1/notificacoes` (e o alias `/notificacoes`) exigem sessão autenticada e operam estritamente sobre os registros do próprio `usuarioId`:

- `GET /api/v1/notificacoes`: aceita `apenasNaoLidas` (`true` ou `false`, padrão `false`) e `limit` (`1` a `50`, padrão `20`). Retorna `{ data, meta: { naoLidas, retornadas } }`.
- `PATCH /api/v1/notificacoes/:id/lida`: marca um alerta do usuário como lido (`404` se inexistente ou pertencente a outra conta).
- `PATCH /api/v1/notificacoes/ler-todas`: marca em lote todos os alertas pendentes do usuário e retorna `{ atualizadas, naoLidas: 0 }`.

Os alertas operacionais cobrem quatro gatilhos deduplicados por `chave_unica`: solicitações urgentes destinadas a `ADMIN` e `GESTOR`, decisão de aprovação ou recusa enviada ao solicitante (e ao condutor alocado quando aplicável), conclusão da desinfecção de viatura SVO para `SVO`, `GESTOR` e `ADMIN`, e reconciliação sob demanda de CNH ou documento atual de veículo vencido ou a vencer em até 30 dias.
