# Roteiro Oficial de Apresentação e Gravação do Pitch (10 Minutos)

> **Fundação de Saúde Parreiras Horta (FSPH) · Squad 19 — Projeto ROTA**  
> **Entrega Final — Takeoff (Porto Digital & Unit)**  
> **Conceito Narrativo:** *"Cold Open de Alto Risco + O Dia de Vitor (Viagens Institucionais & SVO) + Demo Split-Screen (Web Gestor + PWA Motorista) + Tese 'Forjado com IA, Runtime Zero-Alucinação'"*  
> _Roteiro estruturado segundo aSegundo Parte do documento oficial da Entrega Final, cobrindo explicitamente todos os subitens dos critérios **2.1**, **2.2**, **2.3** e **2.4** (5,0 pontos)._

---

## ⏱️ Cronograma Executivo dos 10 Minutos (Mapeado à Rubrica Oficial)

| Slide | Minutagem | Duração | Item Oficial do Documento (Rubrica) | Técnica de Pitch Aplicada |
| :---: | :---: | :---: | :--- | :--- |
| **01** | `00:00 – 00:40` | `40 s` | **2.1.a** A problemática e a oportunidade de IA | **Cold Open de Alto Risco:** 08h15 na mesa de Vitor (4 canais simultâneos: Coleta de Sangue HEMOSE, Amostras LACEN, Diretoria e Chamado SVO). |
| **02** | `00:40 – 01:25` | `45 s` | **2.1.b / 2.1.c** Ferramentas utilizadas + Serviços de IA e impactos no desenvolvimento | **Tese de Engenharia:** *"Forjado com IA, Runtime Determinístico"* (Stack + Acervo `/prompts` `PRM-01` a `PRM-05` + 4 ferramentas de IA). |
| **03** | `01:25 – 02:10` | `45 s` | **2.1.d** Diferenciais da solução | **Bento Grid de 5 Pilares:** Viagens Institucionais sem conflito, Conservação/Avarias, Biossegurança SVO, PWA Offline-First e Auditoria LGPD. |
| **04–05** | `02:10 – 04:15` | `2m 05s` | **2.1.e** Demonstração da Solução (Live Demo / Vídeo) | **Split-Screen Storyboard (Web Vitor + Celular PWA Fábio):** Ato 1 (Viagens Institucionais & Frota), Ato 2 (SVO & Biossegurança), Ato 3 (Auditoria LGPD). |
| **06** | `04:15 – 05:20` | `1m 05s` | **2.2.a** Estimativas de custo do uso de IA (chamada / token / usuário) | **Slide de Número Gigante:** `R$ 0,00/mês` no core determinístico vs. `US$ 0,00013/chamada` (`~R$ 2,26/mês` para 3.000 chamadas na FSPH). |
| **07** | `05:20 – 06:10` | `50 s` | **2.2.b / 2.2.c** Trade-offs de custo x qualidade + Viabilidade econômica em escala de produção | **Comparativo Arquitetural:** Por que OSRM/PostGIS determinístico bate LLM em runtime em latência, precisão e viabilidade licitatória no setor público. |
| **08** | `06:10 – 07:00` | `50 s` | **2.3.a / 2.3.c** *"E se a IA falhasse?"* + O que a equipe deixou de fazer porque a IA não era confiável o suficiente | **Matriz de Fronteira Ética e Resiliência:** Queda de provedores LLM = 0 impacto; 4 decisões humanas inegociáveis (Viagens prioritárias, SVO vs. IML, 4 urnas, LGPD). |
| **09** | `07:00 – 08:30` | `1m 30s` | **2.3.b / 2.3.d** Processo de garantia de qualidade dos outputs de IA + Superações e aprendizados | **Funil de 4 Barreiras CI + "Como Domamos a IA":** `tsc`, `oxlint 0 warnings`, `1.110+ testes` e os 3 prompts que falharam (`PRM-01`, `PRM-02`, `PRM-03`) e foram corrigidos. |
| **10** | `08:30 – 09:15` | `45 s` | **2.4.a** Evoluções futuras pensadas pela equipe que não foram implementadas | **Roadmap Pós-MVP:** Guia de Tráfego QR Code, Signature Pad em tela, Detecção de Anomalia Km/L (Cartão Prime) e Heatmap Epidemiológico. |
| **11** | `09:15 – 10:00` | `45 s` | **2.4.b** Apresentação dos membros da equipe e responsabilidades de cada membro | **Grid de Engenharia do Squad 19:** Os 10 integrantes organizados por domínio de responsabilidade + Call-to-Action final. |

---

## 🎬 2.1 Problemática, Solução Proposta e Demonstração (`00:00 – 04:15` · 2,5 pontos)

### 🔹 [Item 2.1.a do Documento] A problemática e a oportunidade de IA (resumo do problema e valor gerado)
- **Minutagem:** `00:00 – 00:40` (Slide 01 — Estética "Callback" Papel Pautado `#F3EFE6` transicionando para Dark Editorial `#0F1C22`)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.1.A · PROBLEMÁTICA E OPORTUNIDADE DE IA]`
  - À esquerda (memória visual da 1ª apresentação em papel pautado): **"08h15 na mesa de Vitor (Gestor de Frota da FSPH)"** com os 4 canais caóticos simultâneos:
    1. 📞 **Telefone:** *"Vitor, tem carro pra levar a equipe da Diretoria às 09h?"*
    2. 💬 **WhatsApp:** *"Fábio já saiu com os insumos do Almoxarifado?"*
    3. 📧 **E-mail HEMOSE / LACEN:** *"Precisamos de veículo para coleta externa de sangue e transporte de amostras biológicas no interior."*
    4. 🚨 **Plantão SVO:** *"Chamado urgente de remoção de óbito natural — qual viatura está livre e higienizada?"*
  - À direita (Dark Editorial `#0F1C22`): **O Valor Gerado pelo ROTA** — Centralização das viagens institucionais e da logística do SVO com conflito zero de agenda, conservação preventiva da frota e engenharia acelerada por IA.
- **Fala Exata do Apresentador:**
  > *"Imaginem que são 8h15 da manhã na mesa do **Vitor**, gestor de frota da **Fundação de Saúde Parreiras Horta (FSPH)**, em Sergipe. Ao mesmo tempo, o telefone toca pedindo carro para uma viagem institucional da Diretoria; chega um WhatsApp cobrando insumos do Almoxarifado; entra um e-mail do **HEMOSE e do LACEN** solicitando veículo para campanha de coleta de sangue e transporte de amostras biológicas; e o plantão do **SVO** aciona uma viatura para remoção de óbito natural.*  
  > *Na primeira apresentação, mostramos que Vitor gerenciava tudo isso no papel, na memória e no WhatsApp — sob risco constante de alocar o mesmo motorista para duas viagens, despachar um veículo com CNH, CRLV ou revisão vencida, ou perder o controle do SLA e da higienização das viaturas do SVO.*  
  > *Hoje, o **Squad 19** apresenta o **ROTA** em produção: nós usamos a **Inteligência Artificial como alavanca de engenharia de software** para transformar o caos de 4 canais desconectados em uma plataforma única, testada e à prova de falhas operacionais."*

---

### 🔹 [Itens 2.1.b e 2.1.c do Documento] Ferramentas utilizadas + Serviços de IA utilizados e impactos no desenvolvimento
- **Minutagem:** `00:40 – 01:25` (Slide 02 — Dark Editorial `#0F1C22`)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.1.B & 2.1.C · STACK TECNOLÓGICA, SERVIÇOS DE IA E IMPACTO]`
  - **Coluna 1 — Ferramentas e Stack da Solução:**
    - **Front-End & PWA Mobile:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Leaflet, Service Workers + IndexedDB.
    - **Back-End & Domínio:** Node.js, Express 5, Prisma ORM 6, Zod, Autenticação `HttpOnly` + CSRF + Rate Limiting.
    - **Dados & Geoespacial:** Neon PostgreSQL + PostGIS + Motor de Rotas OSRM em Docker.
    - **Qualidade & DevOps:** Vitest, Testing Library, Playwright E2E, Oxlint, GitHub Actions, Jira/Confluence.
  - **Coluna 2 — Serviços de IA e Impactos Mensuráveis no Desenvolvimento (`/prompts`):**
    - **Google Gemini (2.5 Pro / Antigravity):** Arquitetura em camadas, schema Prisma/PostGIS (`PRM-01`), máquina de estados de viagens e SVO (`PRM-02`), Trilha de Auditoria LGPD (`PRM-04`) e suítes Vitest.
    - **Anthropic Claude (3.7 / 4 Sonnet):** Revisão de locks transacionais (`FOR UPDATE`), gerador de massa sintética determinística (`seed-demo.ts` — `PRM-03`) e fluxos React.
    - **OpenAI GPT-4o / Codex + GitHub Copilot:** PWA offline-first com sincronização IndexedDB/OSRM (`PRM-05`) e padronização de código entre os 10 desenvolvedores.
    - **Impacto Real:** **20+ migrations**, **+1.110 testes automatizados** (`915 Back-End + 235 Front-End + E2E`) e acervo versionado em `/prompts` no GitHub.
- **Fala Exata do Apresentador:**
  > *"Para construir o ROTA, combinamos uma stack moderna — **React 19, TypeScript e PWA Offline-First** na ponta do usuário e do motorista; **Node.js, Express 5 e Prisma 6** no Back-End; e **PostgreSQL com PostGIS e motor OSRM** para cálculo real de rotas.*  
  > *No ciclo de engenharia, orquestramos quatro serviços de IA com papéis bem definidos e rastreados na pasta `/prompts` do nosso repositório: **Google Gemini e Antigravity** na modelagem de dados, regras de estado e auditoria LGPD; **Claude Sonnet** na revisão de concorrência transacional e geração de dados sintéticos determinísticos; **OpenAI GPT/Codex** na fila offline do PWA; e **GitHub Copilot** na padronização diária.*  
  > *O impacto no desenvolvimento foi extraordinário: saímos do zero para um sistema com mais de 20 migrations e mais de **1.110 testes automatizados** passando no pipeline."*

---

### 🔹 [Item 2.1.d do Documento] Diferenciais da solução
- **Minutagem:** `01:25 – 02:10` (Slide 03 — Bento Grid com 5 Cards)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.1.D · DIFERENCIAIS TÉCNICOS E OPERACIONAIS DA SOLUÇÃO]`
  - **Bento Card 1 (Destaque Principal — O Dia a Dia de Vitor):** **Gestão Inteligente de Viagens Institucionais** — Fluxo `PENDENTE → APROVADA → EM ANDAMENTO → CONCLUÍDA`, bloqueio automático contra choque de horário de motorista/veículo e cancelamento formal auditado com liberação imediata do recurso.
  - **Bento Card 2:** **Conservação Ativa da Frota e Avarias** — Checklist de saída/retorno do motorista que abre chamado de avaria automaticamente, reserva de horário de manutenção preventiva e alertas de CNH, CRLV e revisão por km.
  - **Bento Card 3:** **Segregação Estrita e Biossegurança SVO** — Frotas administrativa e SVO 100% isoladas; limite físico de 4 urnas por viatura; transição automática para `DESINFECCAO` ao fim da coleta e Portal Externo (`SVOE`) com triagem humana.
  - **Bento Card 4:** **PWA Mobile Offline-First para o Motorista (Fábio)** — Diário de bordo no celular com mapa OSRM, captura de GPS PostGIS e fila em IndexedDB que funciona mesmo sem 4G na estrada.
  - **Bento Card 5:** **Governança Pública, Relatórios CSV/PDF e Auditoria LGPD** — Trilha de auditoria imutável (`AuditLog`) com sanitização recursiva de dados sensíveis (`******`) e exportação oficial de relatórios.
- **Fala Exata do Apresentador:**
  > *"E o que torna o ROTA único para a FSPH? São 5 diferenciais práticos:*  
  > *Primeiro, a **Gestão de Viagens Institucionais sem conflito**: Vitor aprova solicitações de qualquer setor com validação automática de disponibilidade de veículo e motorista, e se uma viagem for cancelada com justificativa formal, os recursos voltam a ficar livres no mesmo segundo.*  
  > *Segundo, a **Conservação Integrada da Frota**: quando o motorista Fábio aponta um problema no checklist de retorno, o sistema abre automaticamente um registro de avaria para Vitor programar a manutenção preventiva com reserva de horário.*  
  > *Terceiro, a **Segregação e Biossegurança do SVO**: um carro administrativo nunca é misturado com viatura de remoção; o sistema trava o limite de 4 urnas e coloca a viatura automaticamente em `DESINFECCAO` após a entrega.*  
  > *Quarto, o **PWA Mobile Offline-First** no celular do motorista com rotas OSRM e fila IndexedDB para áreas sem sinal.*  
  > *E quinto, **Governança Pública completa** com relatórios oficiais em CSV e PDF e Trilha de Auditoria LGPD."*

---

### 🔹 [Item 2.1.e do Documento] Demonstração da Solução (`02:10 – 04:15`)
- **Formato Visual de Alto Impacto:** **Split-Screen (Tela Dividida)** — Do lado esquerdo (70% da tela), o **Painel Web do Gestor Vitor**; do lado direito (30% da tela, em moldura mobile), o **PWA do Motorista Fábio**.
- **Roteiro de Cenas e Fala da Demo (2 minutos e 05 segundos):**
  1. **Cena 1 — O Cockpit de Vitor e as Viagens Institucionais (`02:10 – 02:55`):**
     - **Na Tela:** Abrir o **Dashboard Executivo** mostrando a faixa compacta com os **7 KPIs** e os **3 gráficos analíticos acima da dobra** (*Status da Frota*, *Solicitações por Status* e *Consumo/Rodagem no Mês*), além dos alertas de CNH/documentos a vencer. Em seguida, ir para **Solicitações de Viagem**: aprovar uma viagem institucional para o interior alocando Fábio e um veículo disponível (mostrando que o sistema impede conflito de horário) e demonstrar o **Cancelamento Formal com motivo obrigatório**, liberando imediatamente o veículo.
     - **Fala:** *"Vamos ver isso funcionando na prática. Aqui no topo do Dashboard de Vitor, ele enxerga de imediato os 7 indicadores da fundação e os 3 gráficos analíticos sem precisar rolar a página, além dos alertas de documentos e CNH a vencer. Quando entra uma solicitação de viagem institucional — por exemplo, transporte de insumos ou coleta do HEMOSE — Vitor aprova alocando o motorista Fábio e o veículo livre. O sistema bloqueia qualquer choque de agenda. E se o setor precisar cancelar a viagem antes da saída, o ROTA exige motivo formal, grava na auditoria e libera o carro e o motorista instantaneamente."*
  2. **Cena 2 — Do Celular de Fábio (PWA) para a Gestão de Avarias e Manutenção de Vitor (`02:55 – 03:25`):**
     - **Na Tela:** Na janela mobile do **PWA do Motorista (Fábio)**, mostrar o início e conclusão da viagem com rota OSRM e o preenchimento do **Checklist de Retorno** reportando uma avaria. Na tela Web de Vitor, mostrar a avaria recém-aberta e a **Programação de Manutenção Preventiva** reservando a janela de horário da oficina.
     - **Fala:** *"Na ponta direita, vemos o celular do motorista Fábio no nosso PWA: ele visualiza a rota calculada pelo OSRM, registra a saída e, no retorno, preenche o checklist apontando um desgaste no freio. Automaticamente, essa observação vira um chamado na tela de Avarias de Vitor, que já agenda a manutenção preventiva bloqueando o horário daquele veículo para evitar que ele seja escalado."*
  3. **Cena 3 — Operação Crítica SVO e Biossegurança (`03:25 – 03:55`):**
     - **Na Tela:** Mostrar a entrada de uma solicitação externa (`SVOE`), a triagem da atendente, os cards de **SLA médio do SVO**, a emissão da Ordem de Coleta respeitando o limite de 4 urnas, o motorista Fábio concluindo a entrega no PWA (*Saída → No Local → Entrega no SVO*) e o status da viatura mudando automaticamente para **`DESINFECCAO`**.
     - **Fala:** *"Já no módulo do SVO, acompanhamos o SLA em tempo real. Após a triagem humana do chamado, despachamos a viatura respeitando o limite físico de 4 urnas. Quando o motorista confirma a entrega do corpo na sede do SVO pelo celular, observem o status da viatura: ela entra automaticamente em `DESINFECCAO`, ficando bloqueada para novas coletas até a liberação sanitária."*
  4. **Cena 4 — Fechamento da Demo: Relatórios CSV/PDF e Trilha de Auditoria LGPD (`03:55 – 04:15`):**
     - **Na Tela:** Mostrar os botões de exportação oficial **CSV/PDF** e abrir a tela de **Trilha de Auditoria**, clicando em **"Ver Payload"** para exibir os campos sensíveis mascarados com `******`.
     - **Fala:** *"E para fechar o ciclo de controle público, Vitor exporta relatórios gerenciais em CSV ou PDF com um clique, enquanto o Administrador audita cada operação na Trilha de Auditoria, onde senhas, tokens e CPFs são recursivamente mascarados com asteriscos em conformidade com a LGPD."*

---

## 💰 2.2 Análise de Custo e Viabilidade Econômica (`04:15 – 06:10` · 1,0 ponto)

### 🔹 [Item 2.2.a do Documento] Estimativas de custo do uso de IA (custo por chamada / token / usuário)
- **Minutagem:** `04:15 – 05:20` (Slide 06 — Tipografia de Impacto com Número Gigante + Tabela Matemática)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.2.A · ESTIMATIVAS DE CUSTO POR CHAMADA, TOKEN E USUÁRIO]`
  - Dois grandes números lado a lado:
    - **`R$ 0,00 / mês`** — Custo variável de tokens no **Core Operacional em Produção** (Regras determinísticas TypeScript + OSRM/PostGIS self-hosted).
    - **`US$ 0,00013 / chamada`** (`~R$ 2,26 / mês`) — Custo projetado do **Módulo Consultivo de IA** (Gemini 2.5 Flash / GPT-4o-mini) para toda a operação da FSPH.
  - Tabela detalhada na base do slide:
    - **Preço Base do Modelo:** Entrada `US$ 0,10 / 1M tokens` · Saída `US$ 0,40 / 1M tokens`.
    - **Consumo por Chamada:** `500 tokens in` + `200 tokens out` = `700 tokens` → **`US$ 0,00013 / chamada`** (`R$ 0,00075`).
    - **Volumetria Mensal FSPH:** `2.100 viagens/operações adm` + `900 chamados SVO` = **`3.000 chamadas/mês`** (`1,5M tokens in` = `US$ 0,15` + `600k tokens out` = `US$ 0,24`) → **`US$ 0,39 / mês` (`~R$ 2,26 / mês`)**.
    - **Custo por Usuário Ativo (~60 usuários entre gestores, atendentes, motoristas e solicitantes):** **`US$ 0,0065 / usuário / mês`** (`~R$ 0,038` — menos de 4 centavos de real por usuário/mês).
- **Fala Exata do Apresentador:**
  > *"Entrando no bloco 2.2, sobre análise de custo e viabilidade econômica: quanto custa operar a inteligência do ROTA na FSPH?*  
  > *No nosso **core operacional em produção**, o custo mensal de chamadas de LLM é **zero real**, porque todas as travas de conflito de viagem, cálculo de rota e biossegurança foram compiladas em código determinístico.*  
  > *Mas nós também calculamos na ponta do lápis o custo de um **módulo consultivo de LLM em produção** — usando **Gemini 2.5 Flash** ou **GPT-4o-mini** para pré-triagem assistida e resumo executivo de relatórios para o Vitor:*  
  > *Cada chamada consome em média **500 tokens de entrada e 200 de saída**, custando **13 centésimos de milésimo de dólar (`US$ 0,00013`) por chamada**.*  
  > *Para toda a operação da FSPH — somando **2.100 viagens e operações administrativas** e **900 chamados do SVO**, num total de **3.000 chamadas por mês** — o consumo mensal é de 1,5 milhão de tokens de entrada e 600 mil de saída. Isso dá **39 centavos de dólar por mês**, ou **R\$ 2,26 mensais para a fundação inteira** — menos de **4 centavos de real por usuário ativo ao mês**."*

---

### 🔹 [Itens 2.2.b e 2.2.c do Documento] Trade-offs de custo x qualidade do sistema + Reflexão sobre viabilidade econômica em escala de produção
- **Minutagem:** `05:20 – 06:10` (Slide 07 — Quadro Comparativo de Trade-offs e Escala Pública)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.2.B & 2.2.C · TRADE-OFFS CUSTO X QUALIDADE E VIABILIDADE EM ESCALA]`
  - **Card Esquerdo (2.2.b — Trade-off Custo x Qualidade):**
    - *Abordagem Ingênua (LLM no Runtime Core):* Latência de `1,5s a 3,0s` por clique, custo variável em dólar, risco de não-determinismo na alocação da frota.
    - *Arquitetura ROTA (IA na Engenharia + Runtime Determinístico + OSRM):* Latência `< 50 ms`, precisão `100% determinística` validada por `1.110+ testes`, custo de API de rotas e regras = `R$ 0,00`.
  - **Card Direito (2.2.c — Viabilidade Econômica em Escala de Produção Pública):**
    - Elimina entraves de licitação pública com faturas variáveis internacionais no fluxo crítico.
    - Se a solução escalar 10x para toda a Secretaria de Estado da Saúde (`30.000 chamadas/mês`), o módulo consultivo de IA custará apenas **`~R$ 22,60/mês`**, rodando em infraestrutura cloud enxuta (PostgreSQL/PostGIS + Node.js).
- **Fala Exata do Apresentador:**
  > *"Qual foi o nosso trade-off de custo versus qualidade? Se colocássemos uma LLM comercial no meio do clique em que Vitor aprova uma viagem ou calcula uma rota, adicionaríamos 2 segundos de latência, dependência de API externa e risco de alucinação. Ao usar a IA intensivamente na **engenharia e geração de testes** e adotar o motor open-source **OSRM com PostGIS** para rotas, entregamos qualidade determinística de 100%, resposta abaixo de 50 milissegundos e zero custo por requisição.*  
  > *Em escala de produção para um órgão público como a FSPH, isso garante viabilidade econômica total: não há surpresa orçamentária em dólar no fluxo crítico e, mesmo que o estado escale o uso em 10 vezes para 30 mil chamadas mensais com apoio consultivo de IA, a fatura de tokens não passaria de **R\$ 23 por mês**."*

---

## 🛡️ 2.3 Limites, Qualidade e Aprendizados (`06:10 – 08:30` · 1,0 ponto)

### 🔹 [Itens 2.3.a e 2.3.c do Documento] "E se a IA falhasse?" + O que a equipe deixou de fazer porque a IA não era confiável o suficiente?
- **Minutagem:** `06:10 – 07:00` (Slide 08 — Matriz de Resiliência & As 4 Fronteiras onde a IA é Proibida de Decidir)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.3.A & 2.3.C · RESILIÊNCIA A FALHAS E LIMITES ÉTICOS/TÉCNICOS DA IA]`
  - **Bloco Superior (2.3.a — *"E se a IA ou a Rede falhassem?"*):**
    - **Queda Global de LLMs (OpenAI/Google/Anthropic offline):** **Zero impacto operacional** — Vitor continua aprovando viagens institucionais e despachando o SVO normalmente.
    - **Queda do Motor OSRM ou do 4G do Motorista:** Fallback geodésico automático (Haversine) no servidor e fila **Offline-First em IndexedDB** no celular de Fábio com sincronização idempotente.
  - **Bloco Inferior (2.3.c — *"O que deixamos de delegar à IA por não ser confiável o suficiente?"*):**
    1. 🚫 **Aprovação Autônoma de Viagens Institucionais Prioritárias:** Somente Vitor (Gestor) decide prioridades entre transporte de sangue do HEMOSE, amostras do LACEN e viagens administrativas.
    2. 🚫 **Triagem Automática SVO vs. IML:** Uma alucinação classificando morte violenta/suspeita como morte natural causaria crime pericial. Triagem humana da Atendente + Gestor é obrigatória.
    3. 🚫 **Flexibilização de Biossegurança e Manutenção:** IA jamais pode ignorar o limite de 4 urnas, pular a etapa `DESINFECCAO` ou escalar veículo bloqueado em manutenção.
    4. 🚫 **Exposição de Dados Reais à IA (LGPD):** Zero CPFs, prontuários ou dados reais enviados em prompts; uso exclusivo de geradores sintéticos (`seed-demo.ts`).
- **Fala Exata do Apresentador:**
  > *"No bloco 2.3, respondemos primeiro: **E se a IA falhasse?** Se hoje os servidores da OpenAI, da Anthropic e do Google caírem simultaneamente, **nenhuma viagem institucional do Vitor e nenhuma remoção do SVO para**, porque o nosso runtime não é refém de LLM externa. E se o sinal 4G do motorista Fábio cair numa rodovia do interior, o PWA salva cada evento e coordenada GPS no **IndexedDB** do aparelho e sincroniza sem duplicidade quando a rede volta.*  
  > *Isso se conecta diretamente ao que **nós decidimos NÃO delegar à IA por ela não ser confiável o suficiente em decisões críticas**:*  
  > *1. Não deixamos a IA aprovar ou priorizar viagens institucionais sozinha — decidir entre uma coleta de sangue do HEMOSE e uma demanda administrativa exige o julgamento humano do Vitor;*  
  > *2. Não permitimos triagem autônoma entre **SVO e IML**, pois uma única alucinação sobre causa de óbito geraria grave violação legal e pericial;*  
  > *3. Não permitimos que algoritmos flexibilizem o limite de 4 urnas, o status de `DESINFECCAO` ou o bloqueio de veículos em manutenção;*  
  > *4. E jamais enviamos dados reais de cidadãos ou servidores para LLMs."*

---

### 🔹 [Itens 2.3.b e 2.3.d do Documento] Processo de garantia de qualidade dos outputs de IA + Superações e aprendizados da equipe
- **Minutagem:** `07:00 – 08:30` (Slide 09 — O Funil de 4 Barreiras CI + "Como Domamos a IA: 3 Prompts que Falharam")
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.3.B & 2.3.D · GARANTIA DE QUALIDADE (QA) E APRENDIZADOS DE ENGENHARIA]`
  - **Metade Esquerda (2.3.b — Funil de Qualidade com Tolerância Zero no CI):**
    1. **Compilação Estrita (`tsc --noEmit`):** Proibido `any` ou `@ts-ignore`.
    2. **Linter Determinístico (`oxlint --deny-warnings`):** `0 warnings` e `0 errors` em 280+ arquivos.
    3. **Pirâmide de 1.110+ Testes Automatizados:** **915 testes Back-End (Vitest)** + **235 testes Front-End (Testing Library)** + **Suíte E2E Playwright em Docker**.
    4. **Code Review Humano + Matriz QA Exploratória** por perfil (`ADMIN`, `GESTOR`, `ATENDENTE`, `MOTORISTA`, `SOLICITANTE`).
  - **Metade Direita (2.3.d — Superações e Aprendizados: Os 3 Prompts que Falharam em `docs/PROMPTS_QUE_FALHARAM.md`):**
    - ❌ **Falha 1 (`PRM-01 v1.0`):** Prompt genérico unificou carros administrativos do Vitor e viaturas SVO na mesma tabela sem trava sanitária. → ✅ **Correção (`v3.0`):** *Negative Constraints* + segregação estrita `FROTA_ADM` vs `SVO`.
    - ❌ **Falha 2 (`PRM-02 v1.0`):** IA sugeriu ignorar status `DESINFECCAO` e alocar 6 corpos para "otimizar distância". → ✅ **Correção (`v4.0`):** Máquina de estados com trava hard-coded de 4 urnas e lock transacional `FOR UPDATE` contra condição de corrida.
    - ❌ **Falha 3 (`PRM-03 v1.0`):** IA gerou seed com `Math.random()`, datas no futuro e CPFs inválidos que quebravam os gráficos do Dashboard de Vitor. → ✅ **Correção (`v3.0`):** PRNG determinístico (`Mulberry32(202619)`) com invariantes matemáticos.
- **Fala Exata do Apresentador:**
  > *"Como garantimos a qualidade de cada linha de código gerada com apoio de IA? Nenhum código entrou na `master` sem passar por 4 barreiras automáticas no GitHub Actions: tipagem estrita TypeScript sem `any`, linter **Oxlint com tolerância zero a warnings**, uma bateria de **mais de 1.110 testes automatizados** — sendo 915 no Back-End, 235 no Front-End e testes ponta a ponta com Playwright — além de Code Review humano e Matriz de QA Exploratória.*  
  > *E o nosso maior aprendizado técnico está documentado no nosso relatório de **Prompts que Falharam**: no início, quando demos prompts abertos, a IA tentou misturar carros administrativos do Vitor com viaturas do SVO, sugeriu pular a desinfecção para 'otimizar rota' e gerou seeds aleatórios com `Math.random()` que quebravam os gráficos analíticos. Nós superamos isso aprendendo que **engenharia de prompt de alto nível é engenharia de restrições**: adicionamos invariantes matemáticos, restrições negativas explícitas (`NÃO FAÇA`), locks transacionais `FOR UPDATE` e geradores determinísticos."*

---

## 🚀 2.4 Evoluções Futuras e Equipe (`08:30 – 10:00` · 0,5 ponto)

### 🔹 [Item 2.4.a do Documento] Evoluções futuras pensadas pela equipe que não foram implementadas
- **Minutagem:** `08:30 – 09:15` (Slide 10 — Roadmap Pós-MVP para a FSPH)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.4.A · EVOLUÇÕES FUTURAS MAPEADAS PARA O PÓS-MVP]`
  - 4 Cards de Evolução (2 focados na Frota Institucional de Vitor + 2 focados na Operação de Campo/SVO):
    1. **Detecção Inteligente de Anomalia de Consumo (Km/L — Cartão Prime):** Cruzamento automático entre litros abastecidos e hodômetro das viagens institucionais para alertar Vitor sobre desvios ou falhas mecânicas.
    2. **Guia Oficial de Tráfego e Ordem de Coleta com QR Code Verificável:** Documento com assinatura criptográfica para conferência instantânea em portarias da FSPH, hospitais e fiscalizações de trânsito.
    3. **Assinatura Digital em Tela (Signature Pad no PWA):** Coleta de assinatura touch do solicitante/responsável no encerramento da viagem institucional, no checklist de avaria e no termo de recolhimento do SVO.
    4. **Mapa de Calor Epidemiológico (Heatmap Geoespacial PostGIS):** Painel analítico para a diretoria da FSPH e Secretaria de Saúde visualizarem manchas de acionamento e tempo médio de deslocamento por município de Sergipe.
- **Fala Exata do Apresentador:**
  > *"Olhando para o futuro pós-MVP na FSPH, mapeamos quatro evoluções de alto valor:*  
  > *Para a gestão de frota do Vitor, a **Detecção Inteligente de Anomalias de Consumo (Km/L)**, cruzando dados de abastecimento do Cartão Prime com o hodômetro para alertar desvios ou problemas mecânicos, e a **Guia Oficial de Tráfego com QR Code verificável** para portarias.*  
  > *Já para a operação de campo no PWA do motorista e no SVO, a **Assinatura Digital em Tela (Signature Pad)** no checklist e nos termos de entrega, além de um **Mapa de Calor Geoespacial** em PostGIS para apoiar a diretoria da FSPH no planejamento logístico e epidemiológico em Sergipe."*

---

### 🔹 [Item 2.4.b do Documento] Apresentação dos membros da equipe e responsabilidades de cada membro
- **Minutagem:** `09:15 – 10:00` (Slide 11 — O Time de Engenharia do Squad 19 + Encerramento)
- **O que aparece no Slide:**
  - Badge no topo: `[RUBRICA 2.4.B · SQUAD 19 — EQUIPE E RESPONSABILIDADES TÉCNICAS]`
  - Grid com os **10 integrantes do Squad 19** agrupados em 4 células de engenharia, exibindo o nome e a entrega exata de cada membro:

| Célula de Engenharia | Integrante | Responsabilidades Diretas no Projeto ROTA |
| :--- | :--- | :--- |
| **Arquitetura, Governança & Segurança Core** | **Bruno Santana** | Arquitetura Full-Stack, Trilha de Auditoria LGPD, Cancelamento Formal de Viagens, Modelagem/Auth Isolada do Portal Externo SVO, Relatórios CSV/PDF, Otimização do Dashboard Executivo e Engenharia de Prompts. |
| **Arquitetura, Governança & Segurança Core** | **Kennedhy Santos Reis** | Arquitetura Back-End, Diário Operacional e PWA Offline-First do Motorista com Rotas OSRM/PostGIS, Segurança (`HttpOnly`/CSRF/Rate Limit), Gestão de Avarias e Pipeline CI. |
| **Gestão de Frota Institucional, Dashboard & Conservação** | **Felipe Morais** | Integração do Dashboard Executivo de Vitor, Programação de Manutenção Preventiva com Reserva de Horário, Remanejamento de Recursos em Andamento, Sede de Veículos e Infra HML. |
| **Gestão de Frota Institucional, Dashboard & Conservação** | **Danilo Libório** | Módulo de Acompanhamento de Avarias geradas pelo Checklist de Viagem, Regras de Conservação Veicular e Testes Automatizados. |
| **Gestão de Frota Institucional, Dashboard & Conservação** | **Luiz Mendes** | Desenvolvimento Full-Stack dos Módulos de Frota Institucional, Interfaces de Solicitação de Viagem e Componentes Visuais. |
| **Operações Administrativas, Abastecimento & Cadastros** | **João Pedro** | Endpoints e Interfaces de Controle Operacional, Gestão de Motoristas, Alertas de Documentos/CNH e Contratos Zod. |
| **Operações Administrativas, Abastecimento & Cadastros** | **José Matheus** | Módulos de Abastecimento (Cartão Prime), Manutenções, Fornecedores e Integração Front-End/Back-End. |
| **Portal Externo SVO, Triagem & Qualidade (QA)** | **Anderson Hugo** | Back-End de Solicitações Externas SVO (`SVOE`), Endpoints Operacionais da Frota, Validações de Domínio e Testes de Integração. |
| **Portal Externo SVO, Triagem & Qualidade (QA)** | **Pedro Henrique** | Painel do Gestor/Atendente para Solicitações Externas SVO, Fluxos de Triagem/Aprovação e Testes de Interface React. |
| **Portal Externo SVO, Triagem & Qualidade (QA)** | **Lizandra** | Qualidade de Software (QA), Matriz Exploratória por Perfil de Acesso, Evidências de Regressão E2E e Documentação Funcional. |

- **Fala Exata do Apresentador (`09:15 – 10:00`):**
  > *"Nada disso seria possível sem a execução disciplinada dos **10 integrantes do Squad 19**, organizados em quatro frentes claras:*  
  > *- Na **Arquitetura, Governança e Segurança Core**, **Bruno Santana** liderou a Trilha de Auditoria LGPD, o cancelamento formal de viagens, a modelagem e autenticação do Portal Externo SVO, relatórios CSV/PDF, otimização do Dashboard e o acervo de prompts; e **Kennedhy Santos Reis** liderou o PWA Offline-First do motorista com OSRM/PostGIS, segurança de sessão `HttpOnly`/CSRF e integração contínua.*  
  > *- Na **Frota Institucional e Conservação do dia a dia de Vitor**, **Felipe Morais** entregou a integração do Dashboard, manutenção preventiva com reserva de horário e remanejamento; **Danilo Libório** implementou o fluxo de avarias do checklist; e **Luiz Mendes** atuou nos fluxos full-stack de solicitação e frota.*  
  > *- Nas **Operações Administrativas e Abastecimento**, **João Pedro** estruturou motoristas, documentos e contratos Zod, enquanto **José Matheus** desenvolveu abastecimentos, fornecedores e manutenções.*  
  > *- E no **Portal Externo SVO e Garantia de Qualidade**, **Anderson Hugo** e **Pedro Henrique** construíram o back-end e o painel de triagem externa, e **Lizandra** conduziu nossa Matriz de QA Exploratória e validação ponta a ponta.*  
  > *Nós somos o **Squad 19**. Com o **ROTA**, Vitor governa cada viagem da FSPH, Fábio roda com segurança em campo e o SVO atende Sergipe com precisão e respeito. Muito obrigado!"*
