# Sistema de Gestão de Frota e SVO

[Índice da documentação](README.md)

Plataforma web para centralizar e otimizar a gestão da frota administrativa e da frota do Serviço de Verificação de Óbito (SVO) da Fundação de Saúde Parreiras Horta (FSPH).

O projeto é desenvolvido pelo **Squad 19**, no contexto da Residência em Software e IA (Takeoff), com foco em organizar solicitações, controlar a disponibilidade dos veículos e motoristas e aumentar a rastreabilidade das operações.

## Sumário

- [Contexto e objetivo](#contexto-e-objetivo)
- [Escopo funcional](#escopo-funcional)
- [Regras de negócio importantes](#regras-de-negócio-importantes)
- [Tecnologias](#tecnologias)
- [Visão geral da arquitetura](#visão-geral-da-arquitetura)
- [Como executar](#como-executar)
- [Configuração por variáveis de ambiente](#configuração-por-variáveis-de-ambiente)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Uso de inteligência artificial no desenvolvimento](#uso-de-inteligência-artificial-no-desenvolvimento)
- [Documentação do projeto](#documentação-do-projeto)
- [Equipe](#equipe)
- [Licença](#licença)

## Contexto e objetivo

O controle descentralizado de solicitações, viagens, manutenção e documentação dificulta a organização da frota, a comunicação entre os envolvidos e o acompanhamento das operações. O sistema propõe reunir esses processos em uma única plataforma web, com uma interface adaptável a dispositivos móveis para motoristas.

A solução contempla dois contextos operacionais:

- **Frota administrativa:** solicitações institucionais de transporte, análise e aprovação de viagens, alocação de veículos e motoristas e registro da execução.
- **Frota SVO:** registro de chamados, triagem, emissão e acompanhamento de ordens de coleta, controle de capacidade e liberação de veículos após os procedimentos operacionais necessários.

## Escopo funcional

O escopo do ROTA abrange os módulos e responsabilidades a seguir.

### Gestão administrativa da frota

- Cadastro e gerenciamento de veículos, motoristas e fornecedores.
- Solicitação, aprovação, reprovação e acompanhamento de viagens.
- Alocação de veículos e motoristas conforme disponibilidade e regras operacionais.
- Registro de viagens, quilometragem e checklists de saída e retorno.
- Registro de manutenções preventivas e corretivas.
- Registro de abastecimentos, quilometragem, litragem e custos.
- Controle de documentação de veículos e motoristas, com alertas de vencimento.
- Registro e acompanhamento de multas e infrações.

### Módulo SVO

- Registro de chamados recebidos por telefone.
- Registro e rastreabilidade da decisão de triagem.
- Geração e acompanhamento de ordens de coleta.
- Acompanhamento de etapas da operação, incluindo deslocamento, coleta, entrega e desinfecção.
- Controle de capacidade dos veículos dedicados ao SVO.
- Apoio à logística e ao cálculo de rotas por meio de recursos geoespaciais.

### Administração, segurança e relatórios

- Autenticação e autorização por perfil de usuário.
- Registro de auditoria das operações relevantes.
- Painéis com indicadores operacionais e financeiros.
- Consulta e exportação de relatórios para acompanhamento e prestação de contas.

## Regras de negócio importantes

- **Separação das frotas:** veículos administrativos não devem ser alocados para operações do SVO, e vice-versa.
- **Disponibilidade:** a alocação deve considerar a situação do veículo, do motorista, da documentação e da manutenção.
- **Quilometragem:** os registros de encerramento de uma viagem devem respeitar a consistência dos valores informados.
- **Capacidade do SVO:** a quantidade de ordens ativas não pode ultrapassar a capacidade configurada para o veículo.
- **Desinfecção:** veículos do SVO devem cumprir o procedimento de desinfecção antes de voltar à disponibilidade operacional.
- **Auditoria:** operações relevantes devem manter rastreabilidade de autoria, data e alterações.
- **Acesso restrito:** dados do módulo SVO e informações de localização devem ser acessíveis somente aos perfis autorizados.

Os limites e fluxos específicos são definidos pela especificação de requisitos e pelas regras de negócio do projeto.

## Tecnologias

### Ferramentas do projeto

| Camada                  | Ferramentas                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Front-end               | React 19, TypeScript, Vite 8 e Tailwind CSS 4.                                     |
| Formulários e validação | React Hook Form e Zod; o back-end também usa Zod no módulo de veículos.            |
| Componentes e ícones    | Componentes próprios em `FrontEnd/src/components/common` e Lucide React.           |
| API                     | Express, TypeScript, JWT e bcrypt.                                                 |
| Banco e ORM             | PostgreSQL + PostGIS local em desenvolvimento; Neon PostgreSQL em HML, com Prisma 6. |
| Qualidade e CI          | Oxlint, Vitest, Testing Library, jsdom, checagem de tipos e GitHub Actions.        |
| Execução                | npm workspaces e Docker Compose em desenvolvimento; HML usa Neon por `DATABASE_URL`.       |

### Referência da especificação

A stack definida na especificação inclui:

| Camada                          | Tecnologias                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| Front-end                       | React, TypeScript e Vite                                                |
| Estilização e componentes       | Tailwind CSS e Shadcn/UI ou componentes compatíveis                     |
| Formulários e validação         | React Hook Form e Zod                                                   |
| Comunicação com a API           | Axios e TanStack Query                                                  |
| Back-end                        | Node.js 20+ e TypeScript                                                |
| API                             | Express.js (ou Fastify, conforme decisão de implementação)              |
| Autenticação                    | JWT e Bcrypt                                                            |
| Persistência e ORM              | PostgreSQL e Prisma ORM (ou TypeORM, conforme decisão de implementação) |
| Dados geoespaciais e rotas      | PostGIS e pgRouting                                                     |
| Ambiente de desenvolvimento     | Docker e Docker Compose                                                 |
| Qualidade e integração contínua | GitHub Actions, TypeScript, ESLint e Prettier                           |

Essa referência reúne as ferramentas e alternativas consideradas na especificação. Os manifests e arquivos de configuração definem as dependências utilizadas pelo projeto.

## Visão geral da arquitetura

A arquitetura do projeto distribui as responsabilidades entre interface web, API e banco de dados:

```text
Usuários
   |
   v
Front-end (React + TypeScript + Vite)
   |
   | Requisições HTTP / API REST
   v
Back-end (Node.js + TypeScript)
   |
   | Regras de negócio, autenticação e autorização
   v
PostgreSQL + PostGIS (local em desenvolvimento / Neon em HML)
```

A API é organizada em módulos e deve concentrar as validações, permissões, regras de alocação e controles de integridade. O banco relacional armazena os dados operacionais; as extensões geoespaciais dão suporte a consultas de localização e cálculo de rotas.

## Como executar

O [guia de início](INICIO.md) mantém os comandos do dia a dia. Na raiz, para instalar e iniciar os dois workspaces:

```bash
npm ci
npm run dev
```

Também é possível iniciar os serviços com Docker Compose, após configurar as variáveis da raiz:

```bash
docker compose up --build
```

Os pré-requisitos, a clonagem, a configuração dos arquivos `.env`, a execução em segundo plano, os logs, as migrations e a parada dos serviços estão reunidos em [Ambiente](AMBIENTE.md).

## Configuração por variáveis de ambiente

As variáveis configuradas estão descritas em [Ambiente](AMBIENTE.md#arquivos-de-ambiente), incluindo:

- URL PostgreSQL local em desenvolvimento e variável `DATABASE_URL` apontando para Neon em HML.
- Porta da API e endereço da aplicação front-end.
- Chave secreta de JWT, usada para assinar e verificar tokens de acesso.
- Configurações específicas do ambiente e dos serviços.

## Segurança e privacidade

As diretrizes de segurança incluem controles de acesso por perfil, proteção de credenciais, auditoria e restrição de acesso às informações do SVO. O desenvolvimento e os testes devem observar a Lei Geral de Proteção de Dados Pessoais (LGPD).

Para testes e demonstrações, prefira dados sintéticos. Não utilize informações reais de pessoas falecidas, familiares, endereços ou ocorrências sem autorização e controles adequados.

## Uso de inteligência artificial no desenvolvimento

A IA generativa pode ser usada como ferramenta de apoio à engenharia de software, por exemplo, na criação inicial de componentes, schemas, dados fictícios e casos de teste. As decisões de negócio e arquitetura devem ser revisadas pela equipe, e o código gerado deve passar por revisão e testes automatizados antes de ser integrado.

A IA não substitui a validação humana das regras operacionais, especialmente as relacionadas à segregação das frotas, à triagem do SVO e à segurança dos dados.

## Documentação do projeto

A lista de guias, a ordem de leitura e o padrão dos documentos estão no [índice da documentação](README.md).

- [Início e comandos npm](INICIO.md)
- [Ambiente, banco e Docker](AMBIENTE.md)
- [Desenvolvimento front-end](FRONTEND.md)
- [Desenvolvimento back-end e API](BACKEND.md)
- [Testes, lint e cobertura](TESTES.md)
- [CI e comentário nos PRs](CI.md)
- [Branches, commits e pull requests](GITHUB.md)
- [Identidade visual](IDENTIDADE_VISUAL.md)

A documentação de requisitos e planejamento complementa este README e descreve o escopo do MVP, os perfis de usuário, as regras de negócio, a API, a modelagem de dados e os diagramas.

- **Especificação dos Requisitos — Sistema de Gestão de Frota e SVO**
- **Entrega Parcial — Takeoff / Residência em Software e IA — Squad 19**

Use as versões oficiais desses documentos como referência de requisitos e planejamento da equipe.

## Equipe

**Squad 19 — Residência em Software e IA (Takeoff)**

- Bruno Santana
- Felipe Morais
- Anderson Hugo
- Luiz Mendes
- João Pedro
- José Matheus
- Pedro Henrique
- Kennedhy
- Danilo
- Lizandra

## Licença

As condições de uso e distribuição devem seguir a licença definida pelo responsável pelo projeto. Consulte a equipe antes de redistribuir o código ou utilizá-lo externamente.
