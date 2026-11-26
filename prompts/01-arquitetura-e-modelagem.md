# Prompts — Arquitetura e Modelagem de Dados (PRM-01)

Este documento registra os prompts fundamentais utilizados para desenhar a arquitetura em camadas do **BackEnd** (Controller-Service-Repository via Prisma), a tipagem TypeScript compartilhada e a modelagem do banco relacional PostgreSQL com PostGIS para gestão de frotas da FSPH.

---

## 1. Prompt de Definição da Arquitetura em Camadas e Tipagem Estrita

### Versão: `v1.0` -> `v2.1` -> `v3.0`

#### Contexto e Objetivo:

Garantir separação estrita de responsabilidades:

- `Controller`: Trata HTTP, extrai parâmetros, valida payload com schemas Zod (`validar()`) e responde status codes padronizados.
- `Service`: Centraliza a regra de negócio, valida estados operacionais da FSPH e orquestra chamadas Prisma dentro de transações atômicas quando necessário.
- `Middleware`: Autenticação por sessão revogável (`HttpOnly` + JWT), proteção CSRF, rate limiting e verificação de papéis RBAC (`ADMIN`, `GESTOR`, `SVO`, `SOLICITANTE`, `MOTORISTA`, `EXTERNO`).

#### Prompt de Sistema e Engenharia Utilizado:

```markdown
Você é um Arquiteto de Software Especialista em TypeScript, Node.js (Express), Prisma ORM e PostgreSQL + PostGIS.
Estamos construindo o sistema ROTA para a Fundação de Saúde Parreiras Horta (FSPH).

DIRETRIZES ARQUITETURAIS:

1. Padrão Controller-Service com tipagem 100% estrita (TypeScript strict mode, sem 'any', sem '@ts-ignore').
2. Tratamento de exceções padronizado com HttpError (statusCode, message, errors).
3. Todas as validações de entrada devem ser feitas via Zod schemas (.strict()) antes de alcançar a camada de serviço.
4. Para o modelo relacional de gestão de frotas e ordens de viagem:
   - Uma solicitação de viagem possui estados: PENDENTE, APROVADA, RECUSADA, CANCELADA, EM_TRANSITO, CONCLUIDA.
   - O veículo não pode ser alocado em horários conflitantes caso já esteja em viagem ou com reserva de manutenção preventiva.
   - O motorista precisa estar ativo e com CNH válida no período da viagem.
5. Controle de Concorrência:
   - Operações críticas de aprovação, cancelamento, reagendamento e reserva preventiva devem usar transações Prisma (`prisma.$transaction`) com verificação de estado atual / lock ou coluna `versao` para impedir condições de corrida (race conditions).
6. Gere o service e o controller com suporte a paginação limit/offset, retornando metadados de paginação (`page`, `pageSize`, `total`, `totalPages`).
```

#### Evolução e Ajustes (`v2.1` -> `v3.0`):

- **Problema encontrado na `v1.0`**: O modelo gerava services que importavam diretamente `req` e `res` do Express, acoplando a camada de domínio ao protocolo HTTP.
- **Ajuste na `v2.1`**: Inclusão de restrição negativa explícita: _"A camada de Service não pode importar tipos do Express (`Request`, `Response`). Parâmetros devem ser DTOs puros de TypeScript e retorno de dados primitivos/objetos de domínio"_.
- **Evolução na `v3.0` (Sprints 8 a 11)**: Adição de diretrizes de **concorrência otimista (`versao`)** e **locks transacionais (`SELECT ... FOR UPDATE` / `updateMany` condicional)** após identificarmos que duas requisições simultâneas poderiam alocar o mesmo veículo ou cancelar uma viagem já iniciada.

---

## 2. Prompt de Modelagem de Dados Prisma e Enumerações FSPH

### Versão: `v2.0` -> `v3.0`

#### Prompt Utilizado:

```markdown
Com base no contexto operacional da Fundação de Saúde Parreiras Horta (FSPH):
A frota atende duas frentes:

1. Administrativa/Assistencial geral (veículos leves e vans para transporte de servidores, insumos e hemoderivados entre Sede, HEMOSE e LACEN).
2. Serviço de Verificação de Óbito (SVO) com viaturas especiais adaptadas com compartimento refrigerado para até 4 urnas/corpos.

Gere e evolua o schema Prisma contendo:

- Model Veiculo (placa, modelo, ano, propriedade PROPRIO/LOCADO, fornecedorId, sedeAtualId, odometroAtual, kmProximaRevisao, tipoFrota, status: DISPONIVEL, EM_VIAGEM, MANUTENCAO, DESINFECCAO, INATIVO).
- Model DocumentoVeiculo (CRLV, SEGURO, IPVA, VISTORIA, dataVencimento, status).
- Model SolicitacaoViagem (protocolo via ContadorProtocolo, origem, destino, origemCoordenadas, destinoCoordenadas, justificativa, motivoRecusa, motivoCancelamento, status).
- Model ExecucaoViagem e AvariaViagem + AvariaHistorico (rastreabilidade de avarias apontadas no checklist de retorno com encaminhamento para manutenção).
- Model Manutencao (preventiva/corretiva com reserva de janela inicioPrevisto/fimPrevisto e controle de versão).
- Model ChamadoSvo, OrdemColetaSvo, EscalaSvo e DesinfeccaoSvo (com geolocalização PostGIS `geometry(Point, 4326)` e cálculo de SLA).
- Model SaidaOperacional, SaidaOrdem, ComandoSaida, PosicaoSaida e UltimaPosicaoSaida (diário operacional e telemetria PostGIS `geography(Point, 4326)`).

REGRAS OBRIGATÓRIAS:

- Chaves primárias UUID (`gen_random_uuid()`).
- Índices B-Tree em colunas de filtro e índices espaciais `Gist` nas colunas PostGIS.
- Relacionamentos com `onDelete: Restrict` para preservar histórico e auditoria pública.
```
