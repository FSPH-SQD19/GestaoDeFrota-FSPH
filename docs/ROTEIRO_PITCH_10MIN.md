# Roteiro Oficial de Apresentação e Gravação do Pitch (10 Minutos)

> **Fundação de Saúde Parreiras Horta (FSPH) · Squad 19 — Projeto ROTA**  
> **Entrega Final — Takeoff (Porto Digital & Unit)**  
> _Roteiro estruturado para o vídeo de 10 minutos e defesa diante da banca examinadora (Critérios **2.1**, **2.2**, **2.3** e **2.4** — 5,0 pontos)._

---

## ⏱️ Cronograma Executivo dos 10 Minutos

| Bloco da Rubrica | Tempo Alocado | Minutagem | Foco Principal da Fala e Tela |
| :--- | :---: | :---: | :--- |
| **2.1 Problemática, Solução, IA e Demo** | **4 min 00 s** | `00:00 – 04:00` | Dor real da FSPH/SVO, ferramentas de IA na engenharia, diferenciais e Demo ao vivo. |
| **2.2 Análise de Custo e Viabilidade** | **2 min 00 s** | `04:00 – 06:00` | Custo R\$ 0,00 no runtime determinístico vs. US\$ 0,00013/chamada (~R\$ 2,26/mês) com LLM. |
| **2.3 Limites, Qualidade e Aprendizados** | **2 min 30 s** | `06:00 – 08:30` | *"E se a IA falhasse?"*, o que não delegamos à IA (SVO vs. IML / LGPD) e 1.110+ testes. |
| **2.4 Evoluções Futuras e Equipe** | **1 min 30 s** | `08:30 – 10:00` | Roadmap pós-MVP e apresentação das responsabilidades dos 10 membros do Squad 19. |

---

## 🎬 BLOCO 1 — Problemática, Solução Proposta e Demonstração (`00:00 – 04:00` · 2,5 pontos)

### 1.1 A Problemática e a Oportunidade de IA (`00:00 – 00:50`)
- **O que mostrar na tela:** Slide com o contexto da **FSPH (HEMOSE, LACEN e SVO)** em Sergipe e o contraste entre planilhas/papel vs. plataforma ROTA.
- **Texto / Fala de Apresentação:**
  > *"Bom dia à banca! Nós somos o Squad 19 e desenvolvemos o sistema **ROTA** para a **Fundação de Saúde Parreiras Horta (FSPH)**, órgão responsável pelo HEMOSE, pelo LACEN e pelo **Serviço de Verificação de Óbito (SVO)** de Sergipe.*  
  > *A problemática da FSPH dividia-se em duas frentes críticas: na **frota administrativa**, solicitações de transporte de insumos biológicos e servidores sofriam com controles descentralizados, risco de conflito de agenda e falta de alertas de vencimento de CNH, CRLV e revisões por quilometragem. Já no **SVO**, o acionamento para remoção de óbitos naturais exigia controle rigoroso de triagem, capacidade física das viaturas e protocolo sanitário de desinfecção, sem visibilidade do SLA de resposta.*  
  > *A nossa oportunidade com a **Inteligência Artificial** foi utilizá-la como aceleradora de engenharia de software de alta precisão: transformamos regras sanitárias e logísticas complexas em uma plataforma full-stack 100% testada, auditável e resiliente."*

### 1.2 Ferramentas e Serviços de IA Utilizados e Impactos no Desenvolvimento (`00:50 – 01:40`)
- **O que mostrar na tela:** Diagrama da Arquitetura do ROTA + Tabela do Acervo de Prompts (`PRM-01` a `PRM-05`).
- **Texto / Fala de Apresentação:**
  > *"Na stack da solução, utilizamos **React 19, TypeScript, Vite 8 e Tailwind CSS 4** no Front-End e PWA; **Node.js, Express 5 e Prisma 6** no Back-End; e **Neon PostgreSQL com PostGIS e motor OSRM** para geolocalização e rotas.*  
  > *No ciclo de engenharia com IA, combinamos quatro ferramentas:*  
  > *1. **Google Gemini / Antigravity**: para arquitetura de camadas, modelagem Prisma/PostGIS, máquina de estados do SVO, Trilha de Auditoria LGPD e suítes Vitest;*  
  > *2. **Anthropic Claude e OpenAI GPT/Codex**: para revisão de concorrência transacional, geração da massa sintética determinística (`seed-demo.ts`) e implementação do PWA do motorista;*  
  > *3. **GitHub Copilot**: para padronização de código TypeScript entre os 10 membros.*  
  > *O impacto foi direto: entregamos 20+ migrations, mais de 1.110 testes automatizados e cobertura ponta a ponta com rastreabilidade total na pasta `/prompts` do GitHub."*

### 1.3 Diferenciais da Solução (`01:40 – 02:15`)
- **O que mostrar na tela:** Destaques visuais dos 5 diferenciais.
- **Texto / Fala de Apresentação:**
  > *"Os 5 grandes diferenciais técnicos do ROTA são:*  
  > *1. **Segregação Estrita de Frotas e Biossegurança SVO**: viaturas SVO controlam o limite físico de 4 urnas e entram automaticamente em status bloqueante de `DESINFECCAO` ao concluir a coleta;*  
  > *2. **PWA Mobile Offline-First para Motoristas**: diário de bordo com mapa OSRM, captura de GPS PostGIS e fila offline em IndexedDB para trechos sem sinal no interior do estado;*  
  > *3. **Portal de Solicitação Externa SVO**: fluxo com protocolo único (`SVOE`) que passa obrigatoriamente pela triagem da atendente e aprovação do gestor com isolamento horizontal RBAC;*  
  > *4. **Conservação Integrada da Frota**: checklist de retorno que abre avarias automaticamente, reserva de horário de manutenção preventiva e alertas de revisão por km;*  
  > *5. **Trilha de Auditoria Imutável com Sanitização Recursiva LGPD** e exportação oficial de relatórios em CSV e PDF."*

### 1.4 Roteiro da Demonstração da Solução em Tela (`02:15 – 04:00`)
- **Passo 1 — Visão do Gestor/Admin no Dashboard (`02:15 – 02:45`):**
  - Mostrar a **faixa compacta de 7 KPIs** no topo e os **3 gráficos analíticos** visíveis imediatamente (*Status da Frota*, *Solicitações por Status* e *Consumo/Rodagem no Mês*), além dos alertas operacionais de CNH e documentos a vencer em 30 dias.
- **Passo 2 — Fluxo Administrativo: Solicitação, Aprovação, Avaria e Cancelamento (`02:45 – 03:15`):**
  - Mostrar a listagem de Solicitações, a aprovação alocando veículo e motorista sem conflito de agenda, o modal de **Cancelamento Formal com motivo obrigatório** (liberando o recurso imediatamente) e a tela de **Avarias / Programação de Manutenção Preventiva**.
- **Passo 3 — Fluxo SVO e PWA do Motorista (`03:15 – 03:45`):**
  - Na tela do **SVO**, mostrar os indicadores de **SLA médio de resposta e entrega**, a triagem do chamado, a emissão da Ordem de Coleta respeitando a capacidade da viatura, a execução no **PWA do Motorista / Minhas Coletas** (*Saída → No Local → Entrega no SVO*) e a transição automática da viatura para **`DESINFECCAO`**.
- **Passo 4 — Governança: Relatórios CSV/PDF e Trilha de Auditoria LGPD (`03:45 – 04:00`):**
  - Abrir a tela de **Trilha de Auditoria** (exclusiva do `ADMIN`), filtrar por módulo/ação e abrir o modal de **Inspeção de Payload JSON** mostrando os campos sensíveis mascarados com `******` pela sanitização LGPD.

---

## 💰 BLOCO 2 — Análise de Custo e Viabilidade Econômica (`04:00 – 06:00` · 1,0 ponto)

### 2.1 Estimativas de Custo do Uso de IA (por Chamada, Token e Usuário) (`04:00 – 04:50`)
- **O que mostrar na tela:** Tabela matemática do estudo de custo (`docs/IA_E_ENGENHARIA_DE_PROMPT.md`).
- **Texto / Fala de Apresentação:**
  > *"Na análise econômica, avaliamos duas dimensões: o custo do core atual e o custo projetado de um módulo consultivo de LLM em produção na FSPH.*  
  > *Para um módulo consultivo de apoio à pré-triagem textual do SVO e sumarização de relatórios usando um modelo eficiente como **Gemini 2.5 Flash** ou **GPT-4o-mini** (US\$ 0,10 por milhão de tokens de entrada e US\$ 0,40 por milhão de tokens de saída):*  
  > *- Cada chamada consome em média **500 tokens de entrada** e **200 tokens de saída** (700 tokens por requisição), resultando em **US\$ 0,00013 por chamada** (menos de 1 décimo de centavo de real).*  
  > *- Considerando a volumetria de toda a FSPH — cerca de **900 chamados SVO/mês** mais **2.100 operações administrativas**, totalizando **3.000 chamadas/mês** — o consumo mensal é de **1,5 milhão de tokens de entrada** (US\$ 0,15) e **600 mil tokens de saída** (US\$ 0,24), somando apenas **US\$ 0,39 por mês**, ou cerca de **R\$ 2,26 mensais** para toda a fundação."*

### 2.2 Trade-offs de Custo x Qualidade do Sistema (`04:50 – 05:25`)
- **Texto / Fala de Apresentação:**
  > *"Qual foi o nosso principal trade-off de engenharia? Em vez de colocar uma LLM comercial para decidir cada alocação de veículo ou cálculo de rota em tempo de execução — o que traria latência de 1 a 3 segundos, custo recorrente em dólar e risco de alucinação — usamos a IA intensivamente **durante o desenvolvimento** para construir regras determinísticas em TypeScript e integramos o motor open-source **OSRM + PostGIS** em contêiner próprio. Com isso, o custo variável de tokens no core operacional em produção é **R\$ 0,00/mês**, com tempo de resposta em milissegundos e precisão de 100%."*

### 2.3 Reflexão sobre Viabilidade Econômica em Escala de Produção (`05:25 – 06:00`)
- **Texto / Fala de Apresentação:**
  > *"Para um órgão público estadual como a FSPH, essa arquitetura é economicamente ideal: elimina barreiras licitatórias de faturamento variável internacional no core do sistema, opera em infraestrutura enxuta (PostgreSQL + PostGIS + Node/Workers) e, mesmo que a FSPH ative o módulo consultivo de IA e multiplique sua operação por 10 vezes no estado, o custo de inferência permaneceria abaixo de **R\$ 25,00 por mês**."*

---

## 🛡️ BLOCO 3 — Limites, Qualidade e Aprendizados (`06:00 – 08:30` · 1,0 ponto)

### 3.1 "E se a IA falhasse?" (`06:00 – 06:35`)
- **Texto / Fala de Apresentação:**
  > *"Pergunta central da banca: **E se a IA falhasse?**  
  > Na nossa arquitetura, uma queda global nos servidores da OpenAI, Anthropic ou Google **não paralisa um único minuto da operação da FSPH ou do SVO**, porque o runtime de produção não depende de LLM externa para despachar viaturas ou aprovar viagens. E se a rede móvel falhar durante uma coleta no interior de Sergipe, o **PWA do motorista** armazena os comandos e coordenadas GPS localmente no **IndexedDB** e sincroniza de forma idempotente assim que a conexão retorna."*

### 3.2 Processo de Garantia de Qualidade dos Outputs de IA (`06:35 – 07:15`)
- **Texto / Fala de Apresentação:**
  > *"Para impedir que alucinações ou bugs gerados por IA chegassem à `master`, instituímos um funil de 4 barreiras no CI (GitHub Actions):*  
  > *1. **Tipagem Estrita TypeScript (`tsc`)** sem uso de `any` ou `@ts-ignore`;*  
  > *2. **Linter com Tolerância Zero (`oxlint --deny-warnings`)**: qualquer warning em mais de 280 arquivos reprova o build;*  
  > *3. **Mais de 1.110 Testes Automatizados**: sendo **915 testes no Back-End** (Vitest), **235 testes no Front-End** (Testing Library) e suítes **E2E com Playwright em Docker** validando concorrência e segurança;*  
  > *4. **Homologação Exploratória e Code Review entre Pares**: documentados na nossa Matriz de QA (`docs/MATRIZ_QA_EXPLORATORIA.md`) e no relatório de prompts que falharam (`docs/PROMPTS_QUE_FALHARAM.md`)."*

### 3.3 O que a Equipe Deixou de Fazer porque a IA Não Era Confiável o Suficiente? (`07:15 – 07:55`)
- **Texto / Fala de Apresentação:**
  > *"Nós tomamos quatro decisões conscientes do que **NÃO delegar à IA**:*  
  > *1. **Triagem Autônoma SVO vs. IML**: jamais permitimos que uma IA aprove sozinha uma remoção de óbito. Se um caso com indício de violência ou trauma fosse alucinado como morte natural, haveria grave infração legal e pericial. Por isso, a solicitação externa exige validação humana obrigatória da **Atendente do SVO** e aprovação do **Gestor**;*  
  > *2. **Flexibilização de Biossegurança**: a IA em prompts iniciais tentou agrupar 6 corpos ou usar viatura em `DESINFECCAO` para 'otimizar rota' — bloqueamos isso com travas determinísticas de no máximo 4 urnas e quarentena sanitária obrigatória;*  
  > *3. **Autenticação e RBAC**: sessões `HttpOnly`, validação CSRF e isolamento entre perfis são 100% criptográficos e determinísticos;*  
  > *4. **Dados Reais de Saúde (LGPD)**: nenhum CPF, prontuário ou dado real de falecidos foi enviado a LLMs; construímos geradores sintéticos determinísticos."*

### 3.4 Superações e Aprendizados da Equipe durante o Processo (`07:55 – 08:30`)
- **Texto / Fala de Apresentação:**
  > *"Nosso maior aprendizado foi que **a qualidade do output da IA é diretamente proporcional à precisão das restrições negativas e do contexto de domínio no prompt**. Superamos desafios complexos de condições de corrida em aprovações simultâneas (resolvidas com locks transacionais `FOR UPDATE` e controle de versão), migração de autenticação para cookies `HttpOnly` com proteção CSRF e integração geoespacial PostGIS + OSRM."*

---

## 🚀 BLOCO 4 — Evoluções Futuras e Equipe (`08:30 – 10:00` · 0,5 ponto)

### 4.1 Evoluções Futuras Pensadas pela Equipe que Não Foram Implementadas (`08:30 – 09:10`)
- **Texto / Fala de Apresentação:**
  > *"Como evoluções futuras mapeadas para o pós-MVP da FSPH, destacamos:*  
  > *1. **Guia Oficial de Tráfego e Ordem de Coleta com QR Code verificável** para fiscalização rápida em portarias hospitalares e blitz;*  
  > *2. **Assinatura Digital em Tela (Signature Pad)** no checklist do motorista e no termo de recolhimento do corpo pelo SVO;*  
  > *3. **Detecção Inteligente de Anomalia de Consumo (Km/L)** cruzando abastecimentos do Cartão Prime com o odômetro para alertar desvios ou falhas mecânicas;*  
  > *4. **Mapa de Calor Epidemiológico (Heatmap SVO)** por bairro e município para apoiar a vigilância em saúde da Secretaria de Estado da Saúde."*

### 4.2 Apresentação dos Membros da Equipe e Responsabilidades (`09:10 – 10:00`)
- **O que mostrar na tela:** Slide com os 10 integrantes do **Squad 19** e suas frentes de atuação:

| Integrante | Papel e Principais Responsabilidades no Projeto ROTA |
| :--- | :--- |
| **Bruno Santana** | Arquitetura Full-Stack, Trilha de Auditoria LGPD, Cancelamento Formal de Solicitações, Modelagem/Auth Isolada do Portal Externo SVO, Relatórios CSV/PDF, Otimização Analítica do Dashboard e Engenharia de Prompts. |
| **Kennedhy Santos Reis** | Arquitetura Back-End, Diário Operacional e PWA do Motorista com Roteirização OSRM/PostGIS, Segurança de Sessão (`HttpOnly`/CSRF/Rate Limit), Gestão de Avarias e Coordenação de Integração/CI. |
| **Felipe Morais** | Integração do Dashboard Executivo, Programação de Manutenção Preventiva com Reserva de Horário, Remanejamento de Recursos SVO em Andamento, Registro de Sede de Veículos e Infraestrutura HML. |
| **Anderson Hugo** | Back-End de Solicitações Externas SVO, Endpoints Operacionais da Frota, Validações de Domínio e Testes de Integração. |
| **Danilo Libório** | Módulo de Acompanhamento de Avarias do Checklist de Viagem, Regras de Conservação Veicular e Testes Automatizados. |
| **Luiz Mendes** | Desenvolvimento Front-End e Back-End dos Módulos de Gestão de Frota, Componentes de Interface e Fluxos de Solicitação. |
| **João Pedro** | Desenvolvimento de Endpoints e Interfaces de Controle Operacional, Motoristas, Documentos Veiculares e Validações Zod. |
| **José Matheus** | Desenvolvimento nos Módulos de Abastecimento, Manutenções, Fornecedores e Integração Front-End/Back-End. |
| **Pedro Henrique** | Painel do Gestor para Solicitações Externas SVO, Fluxos de Aprovação/Triagem e Testes de Interface React. |
| **Lizandra** | Qualidade de Software (QA), Matriz Exploratória por Perfil, Evidências de Regressão E2E e Documentação Funcional. |
