# Master Prompt para Geração do Deck de Slides no Claude (Claude Design / Artifacts)

> **Como usar:** Copie todo o bloco abaixo e cole diretamente no **Claude (Claude 3.7 / 4 Sonnet com Artifacts ativado)**.  
> Ele foi projetado com **Direção de Arte Editorial Não-Genérica** (evoluindo a identidade visual que vocês criaram na 1ª apresentação: o contraste entre o **Papel Pautado Analógico de Vitor `#F3EFE6`** e o **Cockpit Editorial Petróleo Escuro `#0F1C22`** com tipografia Serif Display + Monospace técnica e Bento Grids estilo Apple/Linear) e inclui **badges explícitos de cada item da rubrica oficial (`2.1` a `2.4`)** para a banca pontuar nota máxima sem esforço.

---

```markdown
Você é um Principal Product Designer (ex-Linear, Apple Keynote e Stripe Press) e Especialista em Storytelling para Pitches de Engenharia de Software.

Sua missão é criar uma **Apresentação de Pitch Interativa Completa em HTML/React/Tailwind (formato 16:9 widescreen, navegável por setas do teclado `←` `→` e barra de progresso inferior)** para a **Entrega Final da Residência Tecnológica Takeoff (Porto Digital & Unit)** do **Squad 19 — Sistema ROTA**, desenvolvido para a **Fundação de Saúde Parreiras Horta (FSPH — Sergipe)**, órgão que administra o **HEMOSE**, o **LACEN** e o **SVO (Serviço de Verificação de Óbito)**.

---

## 1. DIREÇÃO DE ARTE E IDENTIDADE VISUAL (PROIBIDO VISUAL GENÉRICO DE IA!)

NÃO use gradientes roxos/azuis genéricos de SaaS, NÃO use ícones infantis e NÃO faça slides vazios com 3 bullets genéricos.
Nossa identidade visual é chamada **"Editorial Command Center"** e dá continuidade direta à narrativa visual da nossa 1ª apresentação, onde introduzimos as personas reais da FSPH:
- **Vitor** (Gestor de Frota — administra todas as viagens institucionais da FSPH, HEMOSE, LACEN, manutenção, abastecimento, avarias e despacho);
- **Fábio** (Motorista em campo — usa o PWA Mobile no celular para viagens institucionais, checklist de avarias e coletas do SVO);
- **Solicitante / Atendente** (Setores internos da FSPH que pedem viagens institucionais e plantão de triagem do SVO).

### Paleta de Cores Obrigatória:
1. **Tema "Antes / Memória Analógica" (Usado no card esquerdo do Slide 01 como callback visual):**
   - Fundo papel de caderno pautado quente: `#F3EFE6` com linhas horizontais sutis `#E2DDD2` e margem vertical vermelha `#D9534F`.
   - Post-its amarelos `#FEF08A` com sombra seca e anotações manuscritas em vermelho carmim `#C81E1E`.
2. **Tema Principal "ROTA Command Center" (Slides 01 a 11):**
   - Fundo principal: Petróleo Editorial Profundo `#0B151A` com dot-grid técnico sutil (`radial-gradient(#1E333D 1px, transparent 1px)` com `background-size: 20px 20px`).
   - Superfície dos Cards (Bento Grid): `#112129` com borda fina de 1px `#1F3642` e hover `#2D4F60`.
   - Texto Primário: Branco Gelo `#F8FAFC` | Texto Secundário: Cinza Ardósia `#94A3B8`.
   - Acento Institucional & Viagens (Vitor / Frota Adm): Âmbar Ouro `#F59E0B` (badges `PENDENTE`, destaques de título em itálico serifado).
   - Acento de Confirmação / Frota Livre / Sucesso CI: Verde Esmeralda `#10B981` (badges `APROVADA`, `LIVRE`, `PASS`).
   - Acento de Biossegurança / Bloqueio / Alerta Crítico: Rosa Carmim `#F43F5E` (badges `BLOQUEIA`, `DESINFECCAO`, travas de segurança).
   - Acento Geoespacial / PWA / OSRM: Azul Ciano Técnico `#38BDF8`.

### Tipografia (Importar do Google Fonts no HTML):
- **Títulos de Impacto (Display):** `'Instrument Serif'` ou `'Playfair Display'` (com palavras-chave em *itálico cor âmbar `#F59E0B`* ou *esmeralda `#10B981`*).
- **Corpo e UI:** `'Plus Jakarta Sans'` ou `'Inter'`, leitura limpa e alta densidade informacional organizada.
- **Metadados, Badges da Rubrica, Métricas, Custos e Código:** `'JetBrains Mono'` (ex: `[RUBRICA 2.1.A]`, `US$ 0,00013/call`, `oxlint --deny-warnings`).

### Elementos Visuais de Assinatura em Todos os Slides:
- **Top Header Bar Técnico:** No topo de cada slide, exibir:
  - À esquerda: `SQUAD 19 // FSPH — PROJETO ROTA`
  - Ao centro (EM DESTAQUE): Um Pill Badge Monospace identificando explicitamente qual item do documento oficial de avaliação aquele slide responde (ex: `ITEM 2.1 · PROBLEMÁTICA, SOLUÇÃO E DEMO (2,5 PTS)`).
  - À direita: O tempo exato do cronômetro do pitch de 10 minutos (ex: `⏱ 00:00 – 00:40`).
- **Speaker Notes Drawer (Botão "Ver Fala do Apresentador"):** Adicione um botão discreto no rodapé que abre/fecha a fala exata cronometrada daquele slide para ensaio e gravação.

---

## 2. ARQUITETURA EXATA DOS 11 SLIDES (CONTEÚDO OBRIGATÓRIO)

Construa exatamente os **11 slides** abaixo, sem omitir nenhum dado técnico, métrica ou subitem do documento oficial:

### SLIDE 01 — Cold Open: 08h15 na Mesa de Vitor & A Oportunidade de IA
- **Badge de Rubrica:** `ITEM 2.1.A · A PROBLEMÁTICA E A OPORTUNIDADE DE IA (RESUMO DO PROBLEMA E VALOR GERADO)` | `⏱ 00:00 – 00:40`
- **Título Serifado:** *"08h15 na mesa de Vitor: quatro canais tocando, duas frotas críticas e *zero margem* para erro."*
- **Layout Split Assimétrico (O "Antes Analógico" vs. "O Agora com ROTA"):**
  - **Lado Esquerdo (Estética Papel Pautado `#F3EFE6` — A Dor Real da FSPH):**
    - Mostrar o caos simultâneo que Vitor (Gestor de Frota) enfrentava no papel, memória e WhatsApp:
      1. `📞 TELEFONE (DIRETORIA)`: *"Vitor, tem carro administrativo pra levar a equipe às 09h?"*
      2. `💬 WHATSAPP (ALMOXARIFADO)`: *"Fábio já saiu com a entrega de insumos?"*
      3. `📧 E-MAIL (HEMOSE & LACEN)`: *"Solicitação de veículo para campanha externa de coleta de sangue e transporte de amostras biológicas no interior."*
      4. `🚨 PLANTÃO SVO`: *"Remoção urgente de óbito natural — qual viatura está livre e já passou por desinfecção?"*
    - Riscos reais: Conflito de agenda (mesmo motorista/veículo alocado duas vezes), CNH/CRLV ou revisão por km vencidos sem alerta, falta de rastreio de avarias e ausência de métrica de SLA no SVO.
  - **Lado Direito (Estética Dark Command Center `#0B151A` — A Oportunidade de IA & Valor Gerado):**
    - **Tese Central:** Usamos a **Inteligência Artificial como Aceleradora de Engenharia de Software** para transformar regras logísticas e sanitárias complexas em uma plataforma full-stack determinística, auditável e 100% testada.
    - **3 Pilares de Valor Gerado para a FSPH:**
      - **Para Vitor (Gestão de Viagens e Frota):** Fluxo único `PENDENTE → APROVADA → EM ANDAMENTO → CONCLUÍDA/CANCELADA`, bloqueio automático de choque de horário e conservação preventiva integrada.
      - **Para Fábio (Motorista em Campo):** PWA Mobile Offline-First com rotas OSRM, captura GPS PostGIS e checklist digital que abre avarias automaticamente.
      - **Para o SVO e Governança Pública:** Segregação estrita entre frota administrativa e viaturas SVO (limite de 4 urnas + status bloqueante `DESINFECCAO`), relatórios CSV/PDF e Trilha de Auditoria LGPD.

---

### SLIDE 02 — Ferramentas Utilizadas, Serviços de IA e Impactos no Desenvolvimento
- **Badge de Rubrica:** `ITENS 2.1.B & 2.1.C · FERRAMENTAS UTILIZADAS + SERVIÇOS DE IA E IMPACTOS NO DESENVOLVIMENTO` | `⏱ 00:40 – 01:25`
- **Título Serifado:** *"Engenharia aumentada por IA: como construímos um sistema de *nível industrial* com rastreabilidade total."*
- **Layout em 2 Grandes Blocos (Bento Grid Técnico):**
  - **Bloco 1 — `[2.1.b] Ferramentas e Stack da Solução ROTA`:**
    - **Front-End & PWA Mobile:** React 19, TypeScript 5.8, Vite 8, Tailwind CSS 4, Leaflet Maps, Service Workers + IndexedDB (fila offline).
    - **Back-End & Segurança:** Node.js, Express 5, Prisma ORM 6, Zod, Autenticação via Cookies `HttpOnly`, proteção CSRF e Rate Limiting por rota.
    - **Banco de Dados & Motor Geoespacial:** Neon PostgreSQL + extensão espacial **PostGIS** + Motor de Roteirização **OSRM** containerizado em Docker.
    - **Qualidade & Gestão:** Vitest, Testing Library, Playwright E2E, Oxlint (`--deny-warnings`), GitHub Actions CI, Jira e Confluence.
  - **Bloco 2 — `[2.1.c] Serviços de IA Utilizados e Impactos Mensuráveis (`/prompts`)`:**
    - **Google Gemini (2.5 Pro / Antigravity):** Modelagem Prisma/PostGIS (`PRM-01`), máquina de estados de viagens e SVO (`PRM-02`), Trilha de Auditoria LGPD (`PRM-04`), cancelamento formal e geração de suítes Vitest.
    - **Anthropic Claude (3.7 / 4 Sonnet):** Revisão de concorrência transacional (`SELECT ... FOR UPDATE`), gerador de massa sintética determinística (`seed-demo.ts` — `PRM-03`) e fluxos React.
    - **OpenAI GPT-4o / Codex + GitHub Copilot:** Lógica de sincronização offline IndexedDB + OSRM no PWA (`PRM-05`) e padronização de código TypeScript entre os 10 membros.
    - **Faixa de Impacto Quantitativo (4 Big Numbers):**
      - `20+ Migrations` versionadas no PostgreSQL/PostGIS
      - `1.110+ Testes Automatizados` (`915 Back-End + 235 Front-End + E2E`)
      - `5 Famílias de Prompts` (`PRM-01` a `PRM-05`) versionadas em `/prompts` no GitHub
      - `0 Warnings / 0 Errors` em mais de 280 arquivos TypeScript

---

### SLIDE 03 — Os 5 Diferenciais Competitivos e Técnicos do ROTA
- **Badge de Rubrica:** `ITEM 2.1.D · DIFERENCIAIS DA SOLUÇÃO PARA A FSPH` | `⏱ 01:25 – 02:10`
- **Título Serifado:** *"Cinco diferenciais que unem a *rotina institucional de Vitor* à operação crítica de campo."*
- **Layout Bento Grid de 5 Cards com Tags de Status (`LIVRE`, `APROVADA`, `BLOQUEIA`, `DESINFECCAO`):**
  1. **Card 1 (Destaque Maior — Viagens Institucionais sem Conflito):** **Orquestração Completa de Solicitações de Viagem** — Vitor aprova demandas do HEMOSE, LACEN e setores administrativos com trava transacional contra choque de motorista/veículo, remanejamento controlado e **Cancelamento Formal Auditado** que libera o recurso no mesmo instante.
  2. **Card 2 (Conservação & Manutenção):** **Ciclo Fechado de Avarias e Preventiva** — Quando Fábio reporta um problema no checklist de retorno da viagem, o ROTA abre automaticamente uma avaria; Vitor agenda a manutenção preventiva com **reserva de horário** e monitora alertas de CNH, CRLV e revisão por km.
  3. **Card 3 (Biossegurança SVO):** **Segregação Estrita de Frotas + Protocolo Sanitário** — Carros administrativos jamais se misturam às viaturas do SVO. Controle físico do limite de **4 urnas**, transição automática da viatura para **`DESINFECCAO`** ao encerrar a coleta e Portal Externo (`SVOE`) com triagem humana.
  4. **Card 4 (Operação em Campo):** **PWA Mobile Offline-First para o Motorista** — Diário de bordo no celular com mapa e rota OSRM, captura de coordenadas GPS em PostGIS e fila local em **IndexedDB** que opera mesmo sem sinal 4G nas rodovias de Sergipe.
  5. **Card 5 (Governança Pública):** **Trilha de Auditoria Imutável LGPD + Relatórios Oficiais** — Exportação de relatórios gerenciais em **CSV e PDF** e registro forense de todas as mutações (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`) com mascaramento recursivo `******` de dados sensíveis.

---

### SLIDE 04 — Demonstração (Ato 1): O Cockpit de Vitor, Viagens Institucionais e Conservação
- **Badge de Rubrica:** `ITEM 2.1.E · DEMONSTRAÇÃO DA SOLUÇÃO (PARTE 1: GESTÃO DE VIAGENS INSTITUCIONAIS E FROTA)` | `⏱ 02:10 – 03:20`
- **Título Serifado:** *"Live Demo — Ato 1: Vitor no comando das *viagens institucionais*, avarias e manutenção."*
- **Layout Split-Screen Mockup (70% Tela Web Desktop do Gestor Vitor | 30% Moldura Celular PWA do Motorista Fábio):**
  - **Na Tela Web de Vitor (Esquerda):**
    - Mostrar a representação fiel do **Dashboard Executivo Compacto**: 1 linha superior com os **7 KPIs** (*Total da Frota, Disponíveis, Em Uso, Manutenção, Solicitações Pendentes, Chamados SVO, Avarias*) + os **3 Gráficos Analíticos visíveis acima da dobra** (*Status da Frota*, *Solicitações por Status* e *Consumo/Rodagem no Mês*) + painel de alertas de CNH e documentos a vencer em 30 dias.
    - Abaixo, o fluxo de **Solicitação de Viagem Institucional**: aprovação alocando o motorista Fábio e veículo livre sem conflito de agenda, o botão de **Cancelamento Formal com motivo obrigatório** e o agendamento de **Manutenção Preventiva com reserva de horário**.
  - **Na Moldura Mobile PWA de Fábio (Direita):**
    - Mostrar a tela **"Minhas Viagens"**: rota traçada no mapa via **OSRM**, botão de registrar saída/chegada com GPS e o **Checklist de Retorno** onde Fábio marca uma avaria no freio que aparece instantaneamente no painel de Vitor.

---

### SLIDE 05 — Demonstração (Ato 2): Operação SVO, Biossegurança e Trilha de Auditoria LGPD
- **Badge de Rubrica:** `ITEM 2.1.E · DEMONSTRAÇÃO DA SOLUÇÃO (PARTE 2: LOGÍSTICA SVO, PWA E AUDITORIA LGPD)` | `⏱ 03:20 – 04:15`
- **Título Serifado:** *"Live Demo — Ato 2: Do chamado externo do SVO à *desinfecção automática* e auditoria LGPD."*
- **Layout Split-Screen + Inspecionador JSON Forense:**
  - **Fluxo Operacional SVO (Web + PWA):**
    - Entrada da solicitação externa com protocolo `SVOE-2026-0042` → Triagem humana da Atendente → Painel de **SLA Médio de Resposta e Entrega** → Despacho da Ordem de Coleta validando capacidade (`1/4 urnas ocupadas`) → Motorista Fábio avança no PWA (`SAÍDA → NO LOCAL → ENTREGA NO SVO`) → Viatura muda automaticamente para o badge vermelho **`DESINFECCAO`** (`BLOQUEIA` novas coletas até higienização).
  - **Inspecionador de Governança e Trilha de Auditoria LGPD (`ADMIN`):**
    - Mostrar os botões de exportação **Relatório CSV / PDF** e o modal **"Inspeção de Payload JSON"** da Trilha de Auditoria (`AuditLog`), evidenciando:
      ```json
      {
        "action": "UPDATE",
        "module": "SOLICITACOES",
        "actorRole": "GESTOR",
        "payload": {
          "status": "CANCELADA",
          "motivoCancelamento": "Reagendamento da coleta externa HEMOSE",
          "senha": "******",
          "cpfSolicitante": "******",
          "token": "******"
        }
      }
      ```

---

### SLIDE 06 — Análise de Custo: Quanto Custa Operar a Inteligência do ROTA?
- **Badge de Rubrica:** `ITEM 2.2.A · ESTIMATIVAS DE CUSTO DO USO DE IA (POR CHAMADA, TOKEN E USUÁRIO)` | `⏱ 04:15 – 05:20`
- **Título Serifado:** *"Engenharia financeiramente responsável: *R$ 0,00* no core operacional e frações de centavo em apoio consultivo."*
- **Layout de Impacto Financeiro (2 Cards Gigantes + Tabela Matemática Auditável):**
  - **Big Number 1 (Verde Esmeralda `#10B981`):** **`R$ 0,00 / mês`** — Custo variável de tokens no **Runtime Core em Produção** (Regras de negócio compiladas em TypeScript + Motor de rotas OSRM/PostGIS self-hosted).
  - **Big Number 2 (Âmbar `#F59E0B`):** **`US$ 0,00013 / chamada`** (`~R$ 2,26 / mês`) — Custo projetado do **Módulo Consultivo de IA** (Gemini 2.5 Flash / GPT-4o-mini) para pré-triagem textual e sumarização executiva de relatórios para toda a FSPH.
  - **Tabela Matemática Completa (Exigência Explícita do Item 2.2.a):**
    | Métrica de Custo Analisada | Valor Calculado (USD) | Valor Convertido (BRL · R$ 5,80) | Memória de Cálculo Real para a FSPH |
    | :--- | :---: | :---: | :--- |
    | **Tarifa do Modelo (Gemini 2.5 Flash / GPT-4o-mini)** | `US$ 0,10 / 1M in` · `US$ 0,40 / 1M out` | `R$ 0,58 / 1M in` · `R$ 2,32 / 1M out` | Preço oficial de API comercial de baixa latência |
    | **Custo por Token** | `US$ 0,0000001 (in)` / `US$ 0,0000004 (out)` | `< R$ 0,000002 / token` | Média de `500 tokens entrada` + `200 tokens saída` = `700 tokens/chamada` |
    | **Custo por Chamada (Requisição)** | **`US$ 0,00013 / chamada`** | **`R$ 0,00075 / chamada`** | `(500 × $0,10/1M) + (200 × $0,40/1M)` = menos de 1 décimo de centavo |
    | **Custo Mensal Total FSPH (3.000 chamadas/mês)** | **`US$ 0,39 / mês`** | **`~R$ 2,26 / mês`** | `2.100 viagens/ops adm` + `900 chamados SVO` (`1,5M in` + `600k out`) |
    | **Custo por Usuário Ativo (~60 usuários FSPH)** | **`US$ 0,0065 / usuário / mês`** | **`~R$ 0,038 / usuário / mês`** | Menos de **4 centavos de real por usuário ao mês** |

---

### SLIDE 07 — Trade-offs Custo x Qualidade e Viabilidade Econômica em Escala Pública
- **Badge de Rubrica:** `ITENS 2.2.B & 2.2.C · TRADE-OFFS DE CUSTO X QUALIDADE + VIABILIDADE ECONÔMICA EM ESCALA DE PRODUÇÃO` | `⏱ 05:20 – 06:10`
- **Título Serifado:** *"Por que o runtime determinístico vence em *latência, precisão e viabilidade pública*."*
- **Layout Comparativo Lado a Lado:**
  - **Coluna Esquerda — `[2.2.b] Trade-offs de Custo x Qualidade do Sistema`:**
    - Comparação direta entre **Arquitetura Dependente de LLM em Runtime** vs. **Arquitetura ROTA (AI-Forged + Runtime Determinístico + OSRM)**:
      - **Latência de Resposta:** `1.500ms – 3.000ms` (LLM API) vs. **`< 45ms`** (ROTA TypeScript + PostGIS/OSRM).
      - **Qualidade e Previsibilidade:** Risco de alucinação em choque de horário ou limite de urnas vs. **100% de determinismo** garantido por `1.110+ testes automatizados`.
      - **Custo Geoespacial:** APIs comerciais de rotas (Google Maps API) custariam `> US$ 200/mês` em escala vs. **`R$ 0,00/mês`** com nosso container **OSRM + PostGIS**.
  - **Coluna Direita — `[2.2.c] Reflexão sobre Viabilidade Econômica em Escala de Produção`:**
    - **Adequação ao Setor Público (FSPH / Governo de Sergipe):** Órgãos públicos enfrentam travas orçamentárias e licitatórias para contratar APIs internacionais com cobrança variável imprevisível em dólar no caminho crítico.
    - **Elasticidade 10x (Escala Estadual):** Mesmo que a solução seja expandida em **10 vezes** para toda a rede estadual de saúde (`30.000 chamadas/mês` com módulo consultivo de IA ativo), o custo de inferência será de apenas **`US$ 3,90/mês` (`~R$ 22,60/mês`)**, mantendo viabilidade financeira absoluta.

---

### SLIDE 08 — "E se a IA Falhasse?" & O Que Não Delegamos à IA
- **Badge de Rubrica:** `ITENS 2.3.A & 2.3.C · "E SE A IA FALHASSE?" + O QUE DEIXAMOS DE FAZER PORQUE A IA NÃO ERA CONFIÁVEL O SUFICIENTE` | `⏱ 06:10 – 07:00`
- **Título Serifado:** *"Resiliência operacional e as *quatro fronteiras éticas* onde a IA é proibida de decidir sozinha."*
- **Layout em Duas Camadas de Defesa:**
  - **Camada Superior — `[2.3.a] "E se a IA ou a conectividade falhassem?"`:**
    - **Cenário 1 — Apagão Global das APIs de IA (OpenAI / Google / Anthropic fora do ar):** **Zero minutos de indisponibilidade na FSPH.** Vitor aprova viagens institucionais, agenda manutenções e despacha viaturas SVO normalmente porque nenhuma regra transacional depende de LLM online.
    - **Cenário 2 — Queda do Motor OSRM ou Perda de Sinal 4G na Estrada:** Se o container OSRM oscilar, o Back-End aciona automaticamente o **fallback matemático geodésico (Haversine)** para não travar a viagem; se o celular do motorista Fábio ficar sem internet no interior, o **PWA armazena eventos e coordenadas GPS no IndexedDB** e sincroniza de forma idempotente quando o sinal volta.
  - **Camada Inferior — `[2.3.c] O que a equipe deixou de fazer porque a IA não era confiável o suficiente?` (4 Cards com Badge Vermelho `BLOQUEADO POR DESIGN`):**
    1. **Priorização Autônoma de Viagens Institucionais:** A IA jamais decide sozinha entre uma viagem de coleta de sangue do HEMOSE, transporte de amostras do LACEN ou demanda administrativa. A aprovação final é prerrogativa exclusiva de **Vitor (Gestor)**.
    2. **Triagem Automática de Óbitos (SVO vs. IML):** Jamais permitimos que uma LLM aprove uma remoção de corpo sem revisão humana. Uma alucinação classificando morte violenta/acidente (competência policial do IML) como morte natural geraria grave infração legal e pericial. Exigimos dupla trava humana (**Atendente + Gestor**).
    3. **Flexibilização de Biossegurança e Manutenção:** A IA não pode alterar o limite físico de **4 urnas**, pular o ciclo obrigatório de **`DESINFECCAO`** ou liberar veículo com manutenção reservada.
    4. **Uso de Dados Reais de Saúde e Servidores em Prompts (LGPD):** Nenhum CPF, nome de paciente/falecido ou prontuário real foi enviado a LLMs; toda a engenharia usou dados sintéticos determinísticos (`seed-demo.ts`).

---

### SLIDE 09 — Garantia de Qualidade dos Outputs de IA & Superações (Os 3 Prompts que Falharam)
- **Badge de Rubrica:** `ITENS 2.3.B & 2.3.D · GARANTIA DE QUALIDADE DOS OUTPUTS DE IA + SUPERAÇÕES E APRENDIZADOS` | `⏱ 07:00 – 08:30`
- **Título Serifado:** *"Não confiamos cegamente na IA: construímos um *funil de 4 barreiras* e domamos 3 falhas reais de prompt."*
- **Layout Dividido (Funil de QA à Esquerda | Diff Real de Prompts à Direita):**
  - **Esquerda — `[2.3.b] Processo de Garantia de Qualidade dos Outputs de IA`:**
    - **Barreira 1 — Compilação TypeScript Estrita (`tsc --noEmit`):** Tolerância zero para `any` ou `@ts-ignore` nos contratos Prisma e Zod.
    - **Barreira 2 — Linter Determinístico (`oxlint --deny-warnings`):** Qualquer warning em mais de 280 arquivos quebra o pipeline no GitHub Actions.
    - **Barreira 3 — Pirâmide com 1.110+ Testes Automatizados:** **915 testes Back-End (Vitest)** + **235 testes Front-End (Testing Library)** + **Testes E2E com Playwright em Docker** simulando concorrência real.
    - **Barreira 4 — Code Review Humano + Matriz de QA Exploratória:** Homologação manual perfil a perfil (`ADMIN`, `GESTOR`, `ATENDENTE`, `MOTORISTA`, `SOLICITANTE`).
  - **Direita — `[2.3.d] Superações e Aprendizados: Como Domamos 3 Prompts que Falharam (`docs/PROMPTS_QUE_FALHARAM.md`)`:**
    - **Episódio 1 (`PRM-01` Modelagem):** *Falha da IA (`v1.0`):* Unificou carros administrativos de Vitor e viaturas SVO num mesmo pool sem trava sanitária. → *Superação (`v3.0`):* Adição de *Negative Constraints* explícitas e segregação `FROTA_ADM` vs `SVO`.
    - **Episódio 2 (`PRM-02` Alocação e Concorrência):** *Falha da IA (`v1.0`):* Sugeriu usar viatura em `DESINFECCAO` e alocar 6 corpos para "otimizar rota", além de sofrer condição de corrida em cliques simultâneos. → *Superação (`v4.0`):* Trava hard-coded de 4 urnas + bloqueio sanitário + lock pessimista `SELECT ... FOR UPDATE` no PostgreSQL.
    - **Episódio 3 (`PRM-03` Massa de Dados):** *Falha da IA (`v1.0`):* Usou `Math.random()` gerando datas de chegada anteriores à saída e quebrando os gráficos do Dashboard de Vitor. → *Superação (`v3.0`):* Implementação de PRNG determinístico (`Mulberry32`, semente `202619`) com invariantes cronológicos.

---

### SLIDE 10 — Evoluções Futuras Mapeadas para o Pós-MVP
- **Badge de Rubrica:** `ITEM 2.4.A · EVOLUÇÕES FUTURAS PENSADAS PELA EQUIPE QUE NÃO FORAM IMPLEMENTADAS` | `⏱ 08:30 – 09:15`
- **Título Serifado:** *"O próximo horizonte do ROTA: inteligência preditiva para *Vitor* e validação criptográfica em campo."*
- **Layout Grid 2x2 (Equilíbrio entre Frota Institucional e Operação de Campo/SVO):**
  1. **Detecção Inteligente de Anomalia de Consumo (Km/L — Cartão Prime):** Algoritmo analítico que cruza automaticamente a litragem abastecida no Cartão Prime com o hodômetro registrado nas viagens institucionais para alertar Vitor sobre desvios de combustível ou falhas mecânicas.
  2. **Guia Oficial de Tráfego e Ordem de Coleta com QR Code Verificável:** Emissão de guia digital/impressa com QR Code assinado criptograficamente para validação rápida em portarias da FSPH, hospitais e blitz de fiscalização.
  3. **Assinatura Digital em Tela (Signature Pad no PWA do Motorista):** Coleta de assinatura touch diretamente na tela do celular de Fábio para atestar o encerramento de viagens institucionais, vistoria de avarias e termos de recolhimento do SVO.
  4. **Mapa de Calor Geoespacial e Epidemiológico (Heatmap PostGIS):** Camada analítica para a Diretoria da FSPH e Secretaria de Estado da Saúde visualizarem manchas de demanda logística e incidência geográfica de acionamentos em Sergipe.

---

### SLIDE 11 — Squad 19: A Equipe de Engenharia e Responsabilidades
- **Badge de Rubrica:** `ITEM 2.4.B · APRESENTAÇÃO DOS MEMBROS DA EQUIPE E RESPONSABILIDADES DE CADA MEMBRO` | `⏱ 09:15 – 10:00`
- **Título Serifado:** *"Squad 19: *dez engenheiros*, quatro células de domínio e uma entrega pronta para a FSPH."*
- **Layout Grid Estruturado com os 10 Membros do Squad 19 (Exibir todos os 10 nomes e suas responsabilidades exatas):**
  - **Célula 1 — Arquitetura, Governança & Segurança Core:**
    - **Bruno Santana:** Arquitetura Full-Stack, Trilha de Auditoria LGPD, Cancelamento Formal de Viagens, Modelagem/Auth Isolada do Portal Externo SVO, Relatórios CSV/PDF, Otimização do Dashboard Executivo e Engenharia de Prompts.
    - **Kennedhy Santos Reis:** Arquitetura Back-End, Diário Operacional e PWA Offline-First do Motorista com Rotas OSRM/PostGIS, Segurança (`HttpOnly`/CSRF/Rate Limit), Gestão de Avarias e Pipeline CI.
  - **Célula 2 — Gestão de Frota Institucional, Dashboard & Conservação (O Cockpit de Vitor):**
    - **Felipe Morais:** Integração do Dashboard Executivo, Programação de Manutenção Preventiva com Reserva de Horário, Remanejamento de Recursos em Andamento, Sede de Veículos e Infraestrutura HML.
    - **Danilo Libório:** Módulo de Acompanhamento de Avarias geradas pelo Checklist de Viagem, Regras de Conservação Veicular e Testes Automatizados.
    - **Luiz Mendes:** Desenvolvimento Full-Stack dos Módulos de Gestão de Frota Institucional, Interfaces de Solicitação de Viagem e Componentes Visuais.
  - **Célula 3 — Operações Administrativas, Abastecimento & Cadastros:**
    - **João Pedro:** Endpoints e Interfaces de Controle Operacional, Gestão de Motoristas, Alertas de Documentos/CNH e Contratos de Validação Zod.
    - **José Matheus:** Módulos de Abastecimento (Cartão Prime), Manutenções, Fornecedores e Integração Front-End/Back-End.
  - **Célula 4 — Portal Externo SVO, Triagem & Garantia de Qualidade (QA):**
    - **Anderson Hugo:** Back-End de Solicitações Externas SVO (`SVOE`), Endpoints Operacionais da Frota, Validações de Domínio e Testes de Integração.
    - **Pedro Henrique:** Painel do Gestor e Atendente para Solicitações Externas SVO, Fluxos de Triagem/Aprovação e Testes de Interface React.
    - **Lizandra:** Qualidade de Software (QA), Matriz Exploratória por Perfil de Acesso, Evidências de Regressão E2E e Documentação Funcional.
- **Rodapé de Fechamento Impactante:**
  - *"ROTA // FSPH — Com o ROTA, Vitor governa cada viagem institucional, Fábio roda com segurança em campo e o SVO atende Sergipe com precisão e respeito. · github.com/FSPH-SQD19/GestaoDeFrota-FSPH"*

---

## 3. REQUISITOS TÉCNICOS DO ARTEFATO GERADO
- Gere um único arquivo completo e auto-contido (HTML + Tailwind CSS + Lucide Icons + Google Fonts `Instrument Serif`, `Plus Jakarta Sans` e `JetBrains Mono`) que funcione imediatamente na pré-visualização.
- Inclua navegação fluida por teclado (`ArrowRight`, `ArrowLeft`, `Space`), seletor rápido de slides (1 a 11) no rodapé, indicador de progresso e um botão **"🎙️ Roteiro de Fala (10 min)"** que exibe a fala cronometrada do apresentador em cada slide.
- Capriche nos componentes visuais internos de cada slide: simule mini-telas realistas do Dashboard de Vitor e do celular PWA de Fábio no Split-Screen (Slides 04 e 05), o terminal JSON com `******` da Auditoria LGPD, os blocos de comparação Antes/Depois dos prompts que falharam (Slide 09) e a tabela financeira de tokens (Slide 06).
```
