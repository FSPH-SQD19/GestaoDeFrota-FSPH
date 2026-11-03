# Prompts — Arquitetura e Modelagem de Dados (PRM-01)

Este documento registra os prompts fundamentais utilizados para desenhar a arquitetura em camadas do **BackEnd** (Controller-Service-Repository via Prisma), a tipagem TypeScript compartilhada e a modelagem do banco relacional PostgreSQL com extensões para gestão de frotas da FSPH.

---

## 1. Prompt de Definição da Arquitetura em Camadas e Tipagem Estrita

### Versão: `v1.0` -> `v2.1`

#### Contexto e Objetivo:

Garantir separação estrita de responsabilidades:

- `Controller`: Trata HTTP, extrai parâmetros, valida payload com schemas Zod e responde status codes padronizados.
- `Service`: Centraliza a regra de negócio, valida estados operacionais da FSPH e orquestra chamadas Prisma dentro de transações quando necessário.
- `Middleware`: Autenticação JWT, verificação de papéis RBAC (`ADMIN`, `GESTOR`, `SOLICITANTE`, `MOTORISTA`).

#### Prompt de Sistema e Engenharia Utilizado:

```markdown
Você é um Arquiteto de Software Especialista em TypeScript, Node.js (Express), Prisma ORM e PostgreSQL.
Estamos construindo o sistema ROTA para a Fundação de Saúde Parreiras Horta (FSPH).

DIRETRIZES ARQUITETURAIS:

1. Padrão Controller-Service com tipagem 100% estrita (TypeScript strict mode, sem 'any', sem '@ts-ignore').
2. Tratamento de exceções padronizado com AppError (statusCode, message, code).
3. Todas as validações de entrada devem ser feitas via Zod schemas antes de alcançar a camada de serviço.
4. Para o modelo relacional de gestão de frotas e ordens de viagem:
   - Uma solicitação de viagem possui estados: PENDENTE, APROVADA, REJEITADA, CANCELADA, EM_TRANSITO, CONCLUIDA.
   - O veículo não pode ser alocado em horários conflitantes caso já esteja em viagem ou manutenção.
   - O motorista precisa estar com CNH válida no período da viagem.
5. Gere o service e o controller com suporte a paginação cursor-based ou limit/offset, retornando metadados de paginação.
```

#### Evolução e Ajustes (`v2.1`):

- **Problema encontrado na `v1.0`**: O modelo gerava services que importavam diretamente `req` e `res` do Express, acoplando a camada de domínio ao protocolo HTTP.
- **Ajuste na `v2.1`**: Inclusão de restrição negativa explícita: _"A camada de Service não pode importar tipos do Express (`Request`, `Response`). Parâmetros devem ser DTOs puros de TypeScript e retorno de dados primitivos/objetos de domínio"_.

---

## 2. Prompt de Modelagem de Dados Prisma e Enumerações FSPH

### Versão: `v2.0`

#### Prompt Utilizado:

```markdown
Com base no contexto operacional da Fundação de Saúde Parreiras Horta (FSPH):
A frota atende duas frentes:

1. Administrativa/Assistencial geral (veículos leves e vans para transporte de servidores, insumos e hemoderivados).
2. Serviço de Verificação de Óbito (SVO) com viaturas especiais tipo furgão/cabine dupla adaptadas com compartimento refrigerado para até 4 urnas/corpos.

Gere o schema Prisma contendo:

- Model Veiculo (placa, modelo, marca, ano, odometroAtual, tipoVeiculo, status: DISPONIVEL, EM_VIAGEM, MANUTENCAO, DESINFECCAO, INATIVO).
- Model DocumentoVeiculo (crlv, seguro, ipva, vistoria, dataVencimento).
- Model SolicitacaoViagem (origem, destino, motivo, passageiros, dataSaida, dataRetornoPrevista).
- Model ExecucaoViagem (kmInicial, kmFinal, checklistSaida, checklistRetorno, combustivelSaida, combustivelRetorno).
- Model ChamadoSvo e OrdemColeta (numeroProtocolo, hospitalOrigem, declaracaoObito, dataHoraAcionamento, status: PENDENTE, EM_DESLOCAMENTO, NO_LOCAL, EM_TRANSPORTE, CONCLUIDA, CANCELADA).

REGRAS OBRIGATÓRIAS:

- Chaves primárias UUID ou CUID.
- Índices em colunas de busca frequente (placa, dataVencimento, status, motoristaId).
- Relacionamentos 1:N e N:N devidamente nomeados com onDelete seguro (Restrict para históricos críticos).
```
