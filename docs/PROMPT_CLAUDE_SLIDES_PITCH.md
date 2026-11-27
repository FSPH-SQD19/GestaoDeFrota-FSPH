# Master Prompt Visual "Showroom Interativo" para o Claude Design / Artifacts

> **Regra Anti-Paredão de Texto:** Este prompt foi desenhado para impedir que o Claude gere slides cheios de parágrafos e tabelas longas. Em vez disso, ele obriga o Claude a criar **9 telas cinematográficas com micro-interações clicáveis** (fechar o caderno do Vitor, navegar no Split-Screen Web Vitor + Celular Fábio, arrastar o Slider de custo de `R$ 2,26` para `R$ 22,60`, simular apagão de IA/4G e alternar as 3 falhas de prompt), mantendo o texto longo apenas na gaveta **"🎙️ Ver Fala"**.

---

```markdown
Você é um Creative Technologist e Principal Product Designer (ex-Apple Keynote, Linear e Stripe).

Crie uma **Apresentação Web Interativa Cinematográfica em um único arquivo HTML (Tailwind CSS + Google Fonts `Instrument Serif`, `Plus Jakarta Sans`, `JetBrains Mono` e `Caveat`)** para o Pitch Final de 10 minutos do **Squad 19 — Sistema ROTA**, construído para a **Fundação de Saúde Parreiras Horta (FSPH — Sergipe: HEMOSE, LACEN e SVO)**.

---

## ⚠️ REGRA DE OURO DE DESIGN (PROIBIDO PAREDÃO DE TEXTO!)

1. **Máximo de 15 a 20 palavras por cartão visual.** NUNCA coloque parágrafos longos ou tabelas gigantes na tela principal.
2. **Todo o texto detalhado da fala deve ficar dentro de uma Gaveta Flutuante ("🎙️ Ver Fala [Tecla N]")**, deixando o slide limpo, com tipografia grande, respiro e componentes interativos clicáveis!
3. **Estética "Editorial Command Center":**
   - Fundo escuro petróleo `#091217` com dot-grid sutil (`radial-gradient(#1D3542 1px, transparent 1px)` `24px 24px`).
   - Contraste no Slide 01 com o **"Caderno de Papel Pautado do Vitor"** (`#F3EFE6` com linhas horizontais, margem vermelha e letra manuscrita `Caveat`), que ao clicar num botão **"📕 Fechar o Caderno Agora"** se fecha e dá destaque ao cockpit escuro do ROTA!
   - Cores de acento: Âmbar `#F59E0B` (Viagens Institucionais / Vitor), Esmeralda `#10B981` (Frota Livre / Sucesso CI), Rosa Carmim `#F43F5E` (Biossegurança SVO / Bloqueios), Ciano `#38BDF8` (PWA Motorista / OSRM / PostGIS).
   - No topo de cada tela: `SQUAD 19 // FSPH · PROJETO ROTA`, um Pill Badge com o item explícito do documento (`ITEM 2.1.A`, `ITEM 2.2`, etc.) e o cronômetro daquela tela (`⏱ 00:00 – 00:55`).

---

## ARQUITETURA DAS 9 TELAS INTERATIVAS (CONTEÚDO E MICRO-INTERAÇÕES)

### TELA 01 — Cold Open: "O Caderno Ficou Fechado"

- **Badge:** `ITEM 2.1.A · PROBLEMÁTICA & OPORTUNIDADE DE IA (VALOR GERADO)` | `⏱ 00:00 – 00:55`
- **Visual no Topo (3 Relógios Críticos da FSPH):**
  - **`10:00`** — _HEMOSE · Viagem Institucional (Caixa térmica com bolsas de sangue)_
  - **`14:00`** — _LACEN · Transporte Biológico (Amostras epidemiológicas do interior)_
  - **`03:15`** — _SVO · Plantão 24/7 (Família aciona remoção de óbito natural)_
- **Visual Principal (Interativo):**
  - Card Esquerdo (Estilo Papel Pautado `#F3EFE6` da 1ª apresentação): _"4 canais, 2 frotas e um caderno de papel"_ com post-its amarelos do telefone da Diretoria, WhatsApp do Almoxarifado e a frase manuscrita _"Fábio? Qual placa tá livre?!"_.
  - Botão Interativo **"📕 Fechar o Caderno Agora"**: ao clicar, o card de papel encolhe/fecha com risco e acende o Card Direito do **ROTA Vivo**:
    - Título gigante em `Instrument Serif`: **"Não trouxemos um Figma. Trouxemos o _ROTA vivo_."**
    - 3 Métricas grandes: `1.110+ Testes Automatizados` · `Zero Conflito de Viagens` · `PWA Offline-First + OSRM`.
- **Fala na Gaveta (`[N]`):**
  > "Às 10h da manhã, uma caixa térmica com bolsas de sangue precisa sair do HEMOSE. Às 14h, amostras epidemiológicas precisam chegar ao LACEN. E às 3h15 da madrugada, uma família perde um ente querido em casa e aciona o SVO. Na primeira apresentação, nós mostramos a vocês que toda essa operação crítica do Estado de Sergipe dependia da memória do Vitor, de 4 canais de WhatsApp e de um caderno de papel. E nós fizemos uma promessa: na próxima solicitação, o caderno estaria fechado. Hoje nós não viemos mostrar um protótipo no Figma. Nós viemos mostrar o ROTA vivo, blindado por mais de 1.110 testes automatizados e operando no computador do gestor e no celular do motorista — mesmo sem internet no meio da estrada."

### TELA 02 — A Máquina por Trás do ROTA (Ferramentas & Serviços de IA)

- **Badge:** `ITENS 2.1.B & 2.1.C · FERRAMENTAS UTILIZADAS + SERVIÇOS DE IA E IMPACTO` | `⏱ 00:55 – 01:45`
- **Título Serifado:** _"Forjado com *4 motores de IA*. Blindado por código determinístico."_
- **Visual Limpo em 2 Grids + 4 Big Numbers:**
  - **Esquerda (`[2.1.B] Stack da Solução` — 4 Mini-Cards):**
    1. `FRONT & PWA`: React 19 · TypeScript · Vite 8 · Tailwind 4 · IndexedDB
    2. `BACK & SEGURANÇA`: Node.js · Express 5 · Prisma 6 · Zod · Cookies HttpOnly + CSRF
    3. `GEOESPACIAL`: Neon PostgreSQL + PostGIS + Motor OSRM em Docker
    4. `QUALIDADE & CI`: Vitest · Playwright E2E · Oxlint · GitHub Actions · Jira
  - **Direita (`[2.1.C] Serviços de IA na Engenharia (/prompts)` — 3 Faixas):**
    1. **Google Gemini 2.5 Pro & Antigravity:** Schema Prisma/PostGIS (`PRM-01`), Máquina de Estados (`PRM-02`) e Auditoria LGPD (`PRM-04`).
    2. **Anthropic Claude Sonnet:** Locks transacionais (`SELECT FOR UPDATE`) e Seed Sintético Determinístico (`PRM-03`).
    3. **OpenAI GPT-4o / Codex + GitHub Copilot:** Fila Offline IndexedDB + OSRM no PWA (`PRM-05`) e padronização entre 10 devs.
  - **Rodapé (4 Big Numbers):** `20+ Migrations` · `915 Back + 235 Front + E2E` · `PRM-01..05 no GitHub` · `0 Warnings (280+ arqs)`.

### TELA 03 — Os 5 Diferenciais que Mudam a Rotina de Vitor e Fábio

- **Badge:** `ITEM 2.1.D · DIFERENCIAIS TÉCNICOS E OPERACIONAIS DA SOLUÇÃO` | `⏱ 01:45 – 02:25`
- **Título Serifado:** _"Cinco pilares que unem a *gestão de Vitor* à estrada de *Fábio*."_
- **Bento Grid de 5 Cartões Visuais Curtos:**
  1. **01 · Viagens Institucionais sem Conflito (Coração de Vitor):** Trava contra choque de motorista/veículo para HEMOSE, LACEN e Diretoria + Cancelamento Formal com motivo obrigatório que libera o carro na hora.
  2. **02 · Ciclo Fechado de Avarias e Manutenção:** Checklist de retorno do Fábio abre avaria automática para Vitor agendar manutenção preventiva com reserva de horário + alertas de CNH, CRLV e km.
  3. **03 · Frotas Segregadas & Biossegurança SVO:** Carros administrativos nunca se misturam ao SVO. Limite físico de 4 urnas, transição automática para `DESINFECCAO` e Portal Externo (`SVOE`).
  4. **04 · PWA Motorista Offline-First:** Rotas OSRM, captura GPS PostGIS e fila em IndexedDB que funciona sem sinal 4G na rodovia.
  5. **05 · Auditoria Imutável LGPD & PDF/CSV:** Mascaramento recursivo `******` de dados sensíveis e exportação oficial de relatórios.

### TELA 04 — Showroom Split-Screen Dentro do Slide (Computador do Vitor + Celular do Fábio)

- **Badge:** `ITEM 2.1.E · DEMONSTRAÇÃO DA SOLUÇÃO (SPLIT-SCREEN WEB VITOR + PWA FÁBIO)` | `⏱ 02:25 – 04:20`
- **Componente Interativo com 4 Abas Clicáveis + Botão de Iframe Ao Vivo (`localhost:5173`):**
  - À esquerda (8 colunas): **Moldura MacBook Pro (Visão Web do Gestor Vitor)**.
  - À direita (4 colunas): **Moldura iPhone (Visão PWA Mobile do Motorista Fábio)**.
  - **Aba 1 (`1. Cockpit de Vitor & Viagens Institucionais`):** MacBook mostra a faixa compacta de **7 KPIs + 3 Gráficos Analíticos acima da dobra** e a aprovação da viagem institucional `#SOL-204 (HEMOSE Lagarto/SE)` sem conflito + botão de Cancelamento Formal; iPhone mostra a rota OSRM calculada (`74,8 km`).
  - **Aba 2 (`2. Checklist do Fábio → Avaria & Manutenção de Vitor`):** iPhone mostra Fábio marcando avaria no sistema de freios no checklist de retorno; MacBook mostra a avaria recém-aberta e a janela de **Manutenção Preventiva reservada (08:00–12:00)** bloqueando o veículo.
  - **Aba 3 (`3. Operação SVO & Desinfecção Automática`):** MacBook mostra protocolo externo `SVOE-2026-0042`, SLA médio (`34 min`) e capacidade `1/4 urnas`; iPhone mostra conclusão da entrega na sede do SVO e a viatura entrando automaticamente em badge vermelho **`☣ DESINFECCAO`**.
  - **Aba 4 (`4. Relatórios PDF/CSV & Auditoria LGPD`):** MacBook mostra botões de exportação CSV/PDF e o terminal JSON da Trilha de Auditoria com `"cpfSolicitante": "******"`, `"senhaHash": "******"`.

### TELA 05 — Calculadora Ao Vivo de Custo e Viabilidade em Escala Pública

- **Badge:** `ITEM 2.2 · CUSTO POR CHAMADA/TOKEN/USUÁRIO, TRADE-OFFS E VIABILIDADE EM ESCALA` | `⏱ 04:20 – 05:25`
- **Título Serifado:** _"Custo zero no caminho crítico. *Viabilidade total* para o setor público."_
- **Visual com 2 Números Gigantes + Slider Interativo (`1x` a `10x`):**
  - **Card Esquerdo (`[2.2.B] Core Operacional Hoje`):** **`R$ 0,00 / mês`** — Regras determinísticas em TypeScript + Motor de rotas open-source **OSRM + PostGIS**. Latência `< 45ms`, zero alucinação e zero custo variável de Google Maps ou LLM no clique do Vitor.
  - **Card Direito (`[2.2.A] Módulo Consultivo de IA`):** **`R$ 2,26 / mês`** (`US$ 0,39`) para `3.000 chamadas/mês` (`2.100 viagens adm + 900 SVO`) usando Gemini 2.5 Flash / GPT-4o-mini (`500 tokens in` + `200 tokens out` = **`US$ 0,00013 / chamada`** · **`< R$ 0,04 / usuário ativo`**).
  - **Slider Interativo (`[2.2.C] Escala de Produção Pública`):** Input range de `3.000` (1x FSPH) até `30.000 chamadas/mês` (10x Rede Estadual Completa), recalculando ao vivo na tela de **`R$ 2,26/mês`** até **`R$ 22,62/mês`** (`US$ 3,90`).

### TELA 06 — Simulador de Apagão ("E se a IA Falhasse?") & Os 4 Cadeados Humanos

- **Badge:** `ITENS 2.3.A & 2.3.C · 'E SE A IA FALHASSE?' + O QUE NÃO DELEGAMOS À IA` | `⏱ 05:25 – 06:45`
- **Metade Superior (`[2.3.A] Botão Interativo "⚡ Simular Apagão Global de IA + Corte de 4G na Estrada"`):**
  - Ao clicar, acende em verde esmeralda:
    - `Viagens de Vitor & Despacho SVO: 100% ONLINE (Runtime Determinístico)`
    - `Roteirização: OSRM + Fallback Geodésico Ativo`
    - `Celular do Fábio (PWA): Fila Offline IndexedDB Gravando Sem Perda`
- **Metade Inferior (`[2.3.C] 4 Fronteiras Onde a IA é Proibida de Decidir Sozinha`):**
  1. 🔒 **Priorizar Viagens Institucionais:** Só Vitor decide entre bolsas de sangue do HEMOSE, amostras do LACEN e demandas administrativas.
  2. 🔒 **Triagem Autônoma SVO vs. IML:** Alucinar morte violenta como morte natural causaria crime pericial. Exigimos dupla trava humana (**Atendente + Gestor**).
  3. 🔒 **Flexibilizar 4 Urnas ou Desinfecção:** Nenhuma heurística pode alocar viatura em `DESINFECCAO`, exceder 4 urnas ou liberar carro em manutenção.
  4. 🔒 **Dados Reais em Prompts (LGPD):** Zero CPFs ou prontuários reais enviados a LLMs; 100% dados sintéticos.

### TELA 07 — O Tribunal da Qualidade & Os 3 Prompts que Falharam

- **Badge:** `ITENS 2.3.B & 2.3.D · GARANTIA DE QUALIDADE DOS OUTPUTS DE IA + APRENDIZADOS` | `⏱ 06:45 – 08:25`
- **Título Serifado:** _"Não confiamos cegamente na IA. *Nós a colocamos no banco de réus.*"_
- **Esquerda (`[2.3.B] Funil de 4 Barreiras no CI`):**
  1. `TypeScript + Zod (.strict())` — Zero `any`
  2. `oxlint --deny-warnings` — `0 warnings` em 280+ arquivos
  3. `1.110+ Testes Automatizados` — `915 Back-End + 235 Front-End + Playwright Docker`
  4. `Code Review Humano + Matriz QA Exploratória por Perfil`
- **Direita (`[2.3.D] Componente Interativo com 3 Abas: Os 3 Prompts que Falharam`):**
  - **Aba 1 (`1. Frota Misturada · PRM-01`):** ❌ _Erro v1.0:_ IA misturou carros administrativos do Vitor com viaturas do SVO. → ✅ _Solução v3.0:_ _Negative Constraints_ + segregação estrita `FROTA_ADM` vs `SVO`.
  - **Aba 2 (`2. 6 Urnas & Race Condition · PRM-02`):** ❌ _Erro v1.0:_ IA tentou alocar 6 corpos, ignorou `DESINFECCAO` e permitiu dupla alocação simultânea. → ✅ _Solução v4.0:_ Trava de 4 urnas + Lock pessimista `SELECT ... FOR UPDATE`.
  - **Aba 3 (`3. Seed Aleatório · PRM-03`):** ❌ _Erro v1.0:_ `Math.random()` gerou viagens chegando antes de sair e quebrou os gráficos do Dashboard. → ✅ _Solução v3.0:_ PRNG determinístico (`Mulberry32`, seed `202619`).

### TELA 08 — O Próximo Horizonte do ROTA (Evoluções Futuras Pós-MVP)

- **Badge:** `ITEM 2.4.A · EVOLUÇÕES FUTURAS PENSADAS PELA EQUIPE (PÓS-MVP)` | `⏱ 08:25 – 09:10`
- **Grid 2x2 Visual:**
  1. **Detector de Anomalia Km/L (Cartão Prime):** Cruzamento entre litros abastecidos e hodômetro das viagens para alertar Vitor sobre desvios ou falhas mecânicas.
  2. **Guia de Tráfego e Coleta com QR Code:** Validação criptográfica instantânea em portarias da FSPH, hospitais e blitz.
  3. **Assinatura Digital em Tela (Signature Pad no PWA):** Coleta de assinatura touch no celular de Fábio ao encerrar viagens, checklists e termos SVO.
  4. **Mapa de Calor Geoespacial (Heatmap PostGIS):** Inteligência logística e epidemiológica por município para a Diretoria da FSPH.

### TELA 09 — Squad 19: Os 10 Engenheiros que Fecharam o Caderno

- **Badge:** `ITEM 2.4.B · APRESENTAÇÃO DOS MEMBROS DA EQUIPE E RESPONSABILIDADES` | `⏱ 09:10 – 10:00`
- **Título Serifado:** _"Dez engenheiros. *O caderno ficou fechado.*"_
- **Grid 5x2 com os 10 integrantes do Squad 19 e suas responsabilidades exatas:**
  1. **Bruno Santana** — Arquitetura & Governança (Trilha de Auditoria LGPD, Cancelamento Formal, Modelagem/Auth Portal Externo SVO, Relatórios CSV/PDF, Dashboard e Acervo de Prompts)
  2. **Kennedhy Santos Reis** — Back-End, PWA & Geo (Diário Operacional, PWA Offline-First com Rotas OSRM/PostGIS, Segurança HttpOnly/CSRF/Rate Limit, Avarias e Pipeline CI)
  3. **Felipe Morais** — Dashboard & Manutenção (Integração do Dashboard Executivo de Vitor, Manutenção Preventiva c/ Reserva de Horário, Remanejamento, Sede e Infra HML)
  4. **Danilo Libório** — Conservação & Avarias (Módulo de Acompanhamento de Avarias geradas pelo Checklist de Viagem, Regras de Conservação Veicular e Testes)
  5. **Luiz Mendes** — Full-Stack Frota Adm (Desenvolvimento Full-Stack dos Módulos de Gestão de Frota Institucional, Interfaces de Solicitação de Viagem e UI)
  6. **João Pedro** — Operações & Contratos (Endpoints e Interfaces de Controle Operacional, Gestão de Motoristas, Alertas de Documentos/CNH e Validações Zod)
  7. **José Matheus** — Abastecimento & Custos (Módulos de Abastecimento Cartão Prime, Manutenções, Fornecedores e Integração Front-End/Back-End)
  8. **Anderson Hugo** — Back-End Portal SVOE (Back-End de Solicitações Externas SVO, Endpoints Operacionais da Frota, Validações de Domínio e Testes)
  9. **Pedro Henrique** — Front-End Triagem SVOE (Painel do Gestor e Atendente para Solicitações Externas SVO, Fluxos de Triagem/Aprovação e Testes React)
  10. **Lizandra** — Qualidade (QA) & E2E (Garantia de Qualidade, Matriz Exploratória por Perfil de Acesso, Evidências de Regressão E2E e Documentação Funcional)
```
