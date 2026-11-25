# Roteiro Cinematográfico do Pitch de 10 Minutos — Projeto ROTA (Squad 19)

> **Fundação de Saúde Parreiras Horta (FSPH) · Squad 19 — Entrega Final Takeoff**  
> **Conceito Central:** *"Na próxima solicitação, o caderno fica fechado."*  
> _Um pitch com narrativa humana, visual minimalista de alto impacto (zero paredão de texto nos slides) e cobertura integral de todos os critérios da Entrega Final (**2.1**, **2.2**, **2.3** e **2.4**)._

---

## 🧭 Visão Geral da Coreografia (O Que Aparece na Tela vs. O Que Você Fala)

> **Regra de Ouro Visual:** Nenhum slide tem parágrafos longos. O slide mostra **1 impacto visual por vez** (3 horários na tela, o caderno fechando, o sistema real dividido entre o computador do Vitor e o celular do Fábio, 2 números gigantes de custo, 4 cadeados éticos). **A densidade técnica vai na sua voz.**

| Tela | Tempo | O Que Aparece no Slide (Mínimo Texto, Máximo Impacto) | Critério Coberto na Fala |
| :---: | :---: | :--- | :--- |
| **01** | `00:00 – 00:55` | **`10:00 HEMOSE` · `14:00 LACEN` · `03:15 SVO`** → O caderno de papel pautado se fecha e revela o cockpit escuro do **ROTA**. | **2.1.a** Problemática real da FSPH (Vitor + SVO) e valor gerado. |
| **02** | `00:55 – 01:45` | **Diagrama Limpo em 3 Camadas** (`Web Vitor + PWA Fábio` ↔ `Node/Prisma/PostGIS/OSRM` ↔ `Forjado com 4 IAs` + **`1.110+ Testes`**). | **2.1.b & 2.1.c** Ferramentas utilizadas, serviços de IA e impacto no desenvolvimento. |
| **03** | `01:45 – 02:25` | **5 Cartões Visuais Curtos (Máx. 6 palavras por cartão):** *Viagens sem conflito · Avaria → Manutenção · Frota SVO Isolada (4 urnas/Desinfecção) · PWA Offline-First · Auditoria LGPD*. | **2.1.d** Diferenciais da solução. |
| **04** | `02:25 – 04:20` | **DEMO SPLIT-SCREEN DENTRO DO SLIDE:** Esquerda = **MacBook do Vitor** (Dashboard + Viagens Institucionais + Manutenção + Auditoria) · Direita = **Celular PWA do Fábio** (Rota OSRM + Checklist de Avaria + Entrega SVO). | **2.1.e** Demonstração da solução funcionando ponta a ponta. |
| **05** | `04:20 – 05:25` | **2 Números Gigantes + Slider Interativo:** **`R$ 0,00/mês`** (Core atual) vs. **`R$ 2,26/mês`** (`US$ 0,00013/chamada` para 3.000 chamadas). Arrastando para 10x (Escala Estadual) → **`R$ 22,60/mês`**. | **2.2.a, 2.2.b & 2.2.c** Custo por chamada/token/usuário, trade-offs e viabilidade em escala. |
| **06** | `05:25 – 06:45` | **Botão "Simular Apagão de IA e 4G"** (Tudo continua `ONLINE`) + **Os 4 Cadeados Humanos** (*Prioridade de Viagens do Vitor · Triagem SVO vs. IML · 4 Urnas/Desinfecção · Dados Reais LGPD*). | **2.3.a & 2.3.c** *"E se a IA falhasse?"* + O que não delegamos à IA por não ser confiável. |
| **07** | `06:45 – 08:25` | **O Funil de 4 Barreiras (`0 warnings` + `1.110+ testes`)** + **Toggle Interativo "3 Vezes em que a IA Errou e Como Domamos"** (`PRM-01`, `PRM-02`, `PRM-03`). | **2.3.b & 2.3.d** Garantia de qualidade dos outputs de IA + Superações e aprendizados. |
| **08** | `08:25 – 09:10` | **4 Mockups Visuais do Pós-MVP:** *Anomalia Km/L (Cartão Prime) · Guia com QR Code · Assinatura na Tela do Celular · Mapa de Calor PostGIS*. | **2.4.a** Evoluções futuras pensadas pela equipe. |
| **09** | `09:10 – 10:00` | **Os 10 Engenheiros do Squad 19** organizados em 4 células visuais com a entrega de cada um + Frase final de efeito. | **2.4.b** Apresentação da equipe e responsabilidades individuais. |

---

## 🎙️ Roteiro Completo de Fala (Mantendo o Tom Cinematográfico do Início ao Fim)

---

### 🎬 TELA 01 — A Promessa Cumprida: O Caderno Ficou Fechado (`00:00 – 00:55`)
*(Cobre o item **2.1.a — A problemática e a oportunidade de IA: resumo do problema e valor gerado**)*

* **O que aparece na tela (Visual Minimalista):**
  - Três relógios/marcos acendem em sequência sobre o fundo de papel pautado da 1ª apresentação:
    - **`10:00`** — *HEMOSE · Transporte de bolsas de sangue*
    - **`14:00`** — *LACEN · Amostras epidemiológicas do interior*
    - **`03:15`** — *SVO · Acionamento urgente de óbito natural*
  - Uma animação fecha o caderno de papel com a frase da 1ª apresentação (*"Na próxima solicitação, o caderno fica fechado"*) e abre o tema escuro petróleo do **ROTA (`1.110+ testes · Web + PWA Offline`)**.

* **Sua Fala:**
  > *"Às 10h da manhã, uma caixa térmica com bolsas de sangue precisa sair do **HEMOSE**. Às 14h, amostras epidemiológicas precisam chegar ao **LACEN**. E às 3h15 da madrugada, uma família perde um ente querido em casa e aciona o **SVO**.*  
  > *Na primeira apresentação, nós mostramos a vocês que toda essa operação crítica do Estado de Sergipe dependia da memória do **Vitor**, de 4 canais de WhatsApp e de um caderno de papel — sob risco constante de choque de horário entre viagens, carros rodando com CNH ou revisão vencida e falta de controle sanitário e de SLA no SVO. E lá nós fizemos uma promessa: **na próxima solicitação, o caderno estaria fechado.***  
  > *Hoje nós não viemos mostrar um protótipo no Figma. Nós viemos mostrar o **ROTA vivo** — construído com Inteligência Artificial como alavanca de engenharia, blindado por **mais de 1.110 testes automatizados** e operando hoje no computador do Vitor e no celular do motorista Fábio, mesmo sem internet no meio da estrada."*

---

### ⚙️ TELA 02 — A Máquina por Trás do ROTA: Ferramentas e Engenharia com IA (`00:55 – 01:45`)
*(Cobre os itens **2.1.b — Ferramentas utilizadas** e **2.1.c — Serviços de IA utilizados e impactos no desenvolvimento**)*

* **O que aparece na tela (Visual Minimalista):**
  - Três blocos visuais conectados por linhas luminosas (máximo de 5 palavras por tag):
    1. **Stack em Produção:** `React 19 + PWA IndexedDB` · `Node.js + Express 5 + Prisma 6` · `PostgreSQL + PostGIS + OSRM Docker`
    2. **4 Motores de IA na Engenharia (`/prompts`):** `Gemini 2.5 Pro / Antigravity` · `Claude Sonnet` · `OpenAI GPT / Codex` · `GitHub Copilot`
    3. **Impacto Real (3 Números Grandes):** **`20+ Migrations`** · **`1.110+ Testes`** · **`0 Warnings`**

* **Sua Fala:**
  > *"Para tirar o ROTA do papel com qualidade industrial, construímos uma arquitetura moderna: **React 19, TypeScript, Tailwind 4 e PWA com IndexedDB** na ponta do Vitor e do motorista; **Node.js, Express 5, Prisma 6 e Zod** no Back-End; e **Neon PostgreSQL com extensão espacial PostGIS e um servidor próprio de rotas OSRM em Docker**.*  
  > *Durante o desenvolvimento, nós orquestramos quatro serviços de IA, todos versionados e rastreáveis na pasta `/prompts` do nosso GitHub: usamos **Google Gemini e Antigravity** para modelar o banco, a máquina de estados e a auditoria LGPD; **Claude Sonnet** para blindar transações concorrentes e gerar nossa massa de dados determinística; **OpenAI GPT e Codex** para a sincronização offline do PWA; e **GitHub Copilot** para padronizar o código entre os 10 desenvolvedores.*  
  > *O impacto dessa engenharia aumentada por IA tá nos números: entregamos **mais de 20 migrations** e **1.110 testes automatizados** garantindo cada regra de negócio da FSPH."*

---

### ✨ TELA 03 — Os 5 Diferenciais que Mudam a Rotina da FSPH (`01:45 – 02:25`)
*(Cobre o item **2.1.d — Diferenciais da solução**)*

* **O que aparece na tela (Bento Grid Limpo com 5 Cartões Visuais):**
  1. 🗓️ **Viagens Institucionais sem Conflito** *(Trava de horário + Cancelamento formal)*
  2. 🔧 **Checklist → Avaria → Manutenção** *(Reserva de janela de oficina + Alertas de CNH/Km)*
  3. ☣️ **Biossegurança Estrita no SVO** *(Frotas segregadas · Limite 4 urnas · `DESINFECCAO` automática)*
  4. 📱 **PWA do Motorista Offline-First** *(Rota OSRM + Fila IndexedDB sem 4G)*
  5. 🛡️ **Auditoria Imutável LGPD & PDF/CSV** *(Mascaramento recursivo `******`)*

* **Sua Fala:**
  > *"E por que o ROTA é diferente de qualquer planilha ou sistema genérico de frota? Por cinco diferenciais desenhados sob medida para a FSPH:*  
  > *Primeiro, **Viagens Institucionais sem conflito**: Vitor aprova viagens do HEMOSE, do LACEN e da administração sabendo que o sistema trava qualquer choque de horário, e se uma viagem for cancelada com justificativa formal, o veículo e o motorista voltam a ficar livres no mesmo segundo.*  
  > *Segundo, **Conservação em ciclo fechado**: o que o motorista aponta no checklist de retorno já abre uma avaria automática para Vitor agendar a manutenção preventiva reservando o horário da oficina.*  
  > *Terceiro, **Segregação e Biossegurança no SVO**: carro administrativo nunca se mistura com viatura de remoção; o sistema trava o limite físico de 4 urnas e bloqueia a viatura em `DESINFECCAO` assim que a entrega termina.*  
  > *Quarto, o **PWA Offline-First** no celular do motorista; e quinto, **Auditoria LGPD com relatórios oficiais em CSV e PDF**."*

---

### 🖥️📱 TELA 04 — Demonstração Viva em Split-Screen: O Computador do Vitor + O Celular do Fábio (`02:25 – 04:20`)
*(Cobre o item **2.1.e — Demonstração da Solução**)*

* **O que aparece na tela:**
  - **Dentro do próprio slide**, duas molduras interativas lado a lado:
    - **À Esquerda (MacBook Pro — Visão do Gestor Vitor):** Navegando em 4 abas rápidas (*1. Dashboard 7 KPIs + 3 Gráficos*, *2. Aprovação e Cancelamento de Viagem Institucional + Manutenção*, *3. Painel SVO + SLA*, *4. Trilha de Auditoria LGPD*).
    - **À Direita (iPhone — Visão do Motorista Fábio no PWA):** Mostrando em sincronia (*1. Rota OSRM da viagem*, *2. Checklist de retorno reportando avaria no freio*, *3. Etapas da coleta SVO `Saída → No Local → Entrega → DESINFECCAO`*).

* **Sua Fala durante a Demo (1 min 55 s):**
  - **Passo 1 — O Cockpit do Vitor e as Viagens Institucionais (`02:25 – 03:05`):**
    > *"Olhem para a tela dividida: à esquerda está o computador do **Vitor**; à direita, o celular do motorista **Fábio**. Assim que Vitor abre o Dashboard, ele enxerga os **7 KPIs** da fundação numa única faixa compacta e os **3 gráficos analíticos acima da dobra** — Status da Frota, Solicitações e Consumo no Mês — além dos alertas de CNH e documentos vencendo em 30 dias.*  
    > *Quando entra uma solicitação de viagem institucional do HEMOSE, Vitor aprova alocando Fábio e um veículo disponível. Se dois gestores tentarem alocar o mesmo carro no mesmo horário, o banco bloqueia na hora. E se a viagem precisar ser cancelada antes da saída, Vitor registra o motivo formal, a auditoria grava quem cancelou e o carro fica livre imediatamente."*
  - **Passo 2 — Do Celular do Fábio para a Manutenção Preventiva do Vitor (`03:05 – 03:35`):**
    > *"Agora olhem para o celular do Fábio à direita: ele recebe a viagem no PWA, segue a rota calculada pelo nosso motor OSRM e, ao voltar para a garagem, marca no checklist de retorno um desgaste no freio. No mesmo instante, essa marcação vira um chamado na tela de Avarias do Vitor, que já programa a manutenção preventiva bloqueando a janela de horário daquele veículo."*
  - **Passo 3 — A Operação Crítica do SVO e a Desinfecção Automática (`03:35 – 04:00`):**
    > *"Já no módulo do SVO, Vitor e a atendente acompanham o SLA médio em tempo real. Após a triagem humana de uma solicitação externa, a Ordem de Coleta é despachada respeitando o limite de 4 urnas da viatura. Fábio avança as etapas pelo celular — Saída, No Local e Entrega no SVO — e, no momento da entrega, vejam o status da viatura: ela entra automaticamente em `DESINFECCAO`, impedindo qualquer novo despacho até ser higienizada."*
  - **Passo 4 — Relatórios CSV/PDF e Trilha de Auditoria LGPD (`04:00 – 04:20`):**
    > *"E para fechar a governança pública, Vitor exporta relatórios em CSV ou PDF com um clique, enquanto na Trilha de Auditoria cada alteração no sistema fica registrada com senhas, tokens e CPFs mascarados com asteriscos (`******`) em total conformidade com a LGPD."*

---

### 💰 TELA 05 — A Conta que Fecha: Custo de IA e Viabilidade em Escala Pública (`04:20 – 05:25`)
*(Cobre os itens **2.2.a — Estimativas de custo por chamada/token/usuário**, **2.2.b — Trade-offs de custo x qualidade** e **2.2.c — Viabilidade econômica em escala de produção**)*

* **O que aparece na tela (Visual Limpo com Slider Interativo):**
  - Dois números gigantes lado a lado:
    - **`R$ 0,00 / mês`** *(Core Operacional Determinístico em Produção Hoje)*
    - **`R$ 2,26 / mês`** *(Módulo Consultivo de IA · `3.000 chamadas/mês` · `US$ 0,00013 / chamada` · `< R$ 0,04 / usuário`)*
  - Um **Slider Interativo de Escala**: quando você arrasta de **`1x (FSPH: 3.000 chamadas/mês)`** para **`10x (Escala Estadual: 30.000 chamadas/mês)`**, o valor atualiza ao vivo para **`R$ 22,60 / mês`** (`US$ 3,90`).

* **Sua Fala:**
  > *"Mas quanto custa manter essa inteligência rodando num órgão público como a FSPH?*  
  > *Aqui está o nosso maior **trade-off de custo versus qualidade**: em vez de colocar uma LLM comercial para decidir cada aprovação de viagem ou pagar caro em APIs de mapas a cada clique — o que traria 2 segundos de lentidão, risco de alucinação e fatura em dólar — nós usamos a IA intensivamente **durante a engenharia** para construir código TypeScript determinístico e subimos nosso próprio motor open-source **OSRM com PostGIS**. Por isso, o custo variável de tokens no core operacional em produção hoje é **zero real (`R$ 0,00`)**, com resposta abaixo de 45 milissegundos e precisão de 100%.*  
  > *E se a FSPH quiser ativar um módulo consultivo de IA em produção — usando **Gemini 2.5 Flash ou GPT-4o-mini** para pré-triagem textual e resumo executivo de relatórios para o Vitor? Nós fizemos a conta por token, por chamada e por usuário:*  
  > *Cada chamada consome em média **500 tokens de entrada e 200 de saída**, custando **13 centésimos de milésimo de dólar (`US$ 0,00013`) por chamada**. Para toda a operação da FSPH — **2.100 viagens e operações administrativas mais 900 chamados do SVO**, totalizando **3.000 chamadas por mês** — a conta mensal fecha em **`US$ 0,39`**, ou **R\$ 2,26 por mês para a fundação inteira** — menos de **4 centavos de real por usuário ativo**.*  
  > *E vejam no simulador: mesmo que o Governo de Sergipe escale o uso em **10 vezes** para 30 mil chamadas mensais em toda a rede estadual, o custo continuará abaixo de **R\$ 23 por mês**. É viabilidade econômica absoluta para o setor público."*

---

### 🛡️ TELA 06 — "E se a IA Falhasse?" e as 4 Fronteiras onde a IA é Proibida de Decidir (`05:25 – 06:45`)
*(Cobre os itens **2.3.a — E se a IA falhasse?** e **2.3.c — O que a equipe deixou de fazer porque a IA não era confiável o suficiente?**)*

* **O que aparece na tela:**
  - No topo, um botão interativo **"⚡ Simular Queda Global de IA + Queda de 4G na Estrada"** que, ao ser clicado, mostra os 3 indicadores verdes:
    - `Viagens do Vitor & Despacho SVO: 100% ONLINE (Runtime Determinístico)`
    - `Roteirização: Fallback Geodésico Ativo`
    - `Celular do Fábio (PWA): Fila Offline IndexedDB Sincronizada`
  - Abaixo, **4 Cards com Cadeado Vermelho (`DECISÃO HUMANA / TRAVA DETERMINÍSTICA`)**:
    1. 🔒 **Prioridade de Viagens Institucionais** *(Só Vitor decide entre HEMOSE, LACEN e Administração)*
    2. 🔒 **Triagem Legal SVO vs. IML** *(Dupla validação humana: Atendente + Gestor)*
    3. 🔒 **Limite de 4 Urnas & Desinfecção** *(Imutável por heurística)*
    4. 🔒 **CPFs e Prontuários Reais (LGPD)** *(Zero dados reais enviados a LLMs)*

* **Sua Fala:**
  > *"A banca nos faz uma pergunta crucial: **E se a IA falhasse?**  
  > Olhem o que acontece se hoje os servidores da OpenAI, da Anthropic e do Google caírem ao mesmo tempo: **zero minutos de parada na FSPH**. Vitor continua aprovando viagens e despachando o SVO normalmente, porque nenhuma rota crítica depende de LLM externa. E se o sinal 4G do motorista Fábio cair no meio de uma rodovia no interior, o PWA guarda os eventos e o GPS no **IndexedDB** do celular e sincroniza sem duplicar nada assim que o sinal volta.*  
  > *Essa resiliência nasce das **quatro decisões que nós deixamos de delegar à IA porque ela não é confiável o suficiente quando vidas e leis estão em jogo**:*  
  > *Primeiro: a IA jamais aprova ou prioriza viagens institucionais sozinha — decidir entre uma coleta urgente de sangue do HEMOSE e uma viagem administrativa exige o julgamento humano do Vitor.*  
  > *Segundo: jamais permitimos triagem automática entre **SVO e IML**. Se uma IA alucinasse e classificasse um óbito com suspeita de violência como morte natural, causaria um erro pericial e jurídico gravíssimo. Por isso, toda solicitação externa exige validação humana da Atendente e do Gestor.*  
  > *Terceiro: bloqueamos qualquer tentativa algorítmica de flexibilizar o limite físico de 4 urnas ou pular a desinfecção da viatura.*  
  > *E quarto: nenhum CPF ou dado real de saúde foi enviado para LLMs — operamos 100% com dados sintéticos."*

---

### 🧪 TELA 07 — Como Garantimos a Qualidade e Domamos 3 Falhas Reais da IA (`06:45 – 08:25`)
*(Cobre os itens **2.3.b — Processo de garantia de qualidade dos outputs de IA** e **2.3.d — Superações e aprendizados da equipe durante o processo**)*

* **O que aparece na tela:**
  - **Esquerda (Funil Visual de 4 Degraus Verdes):**
    - `1. TypeScript Estrito (Zero any)` → `2. Oxlint (0 Warnings em 280+ arquivos)` → `3. 1.110+ Testes (915 Back + 235 Front + Playwright E2E)` → `4. Code Review + Matriz QA por Perfil`
  - **Direita (3 Cartões Clicáveis "Antes vs. Depois" dos Prompts que Falharam):**
    - **Card 1 (`PRM-01`):** ❌ *IA misturou carro do Vitor com viatura SVO* → ✅ *Negative Constraints + Segregação Estrita*
    - **Card 2 (`PRM-02`):** ❌ *IA tentou alocar 6 corpos / pular desinfecção + Race condition* → ✅ *Trava 4 urnas + Lock `SELECT ... FOR UPDATE`*
    - **Card 3 (`PRM-03`):** ❌ *`Math.random()` gerou datas impossíveis nos gráficos* → ✅ *Seed Determinístico (`Mulberry32`)*

* **Sua Fala:**
  > *"E como garantimos a qualidade de cada linha de código gerada com apoio de IA? Nós não confiamos cegamente em nenhum output: criamos um funil automático no GitHub Actions com **quatro barreiras implacáveis**: compilação TypeScript estrita sem `any`; linter **Oxlint com tolerância zero a warnings** em mais de 280 arquivos; uma bateria de **mais de 1.110 testes automatizados** — sendo 915 no Back-End com Vitest, 235 no Front-End com Testing Library e testes ponta a ponta em Docker com Playwright — além de Code Review humano e da nossa Matriz de QA Exploratória por perfil.*  
  > *Foi esse funil que nos ensinou a maior lição do projeto, documentada no nosso relatório de **Prompts que Falharam**: quando demos prompts abertos na versão 1.0, a IA cometeu três erros graves:*  
  > *1. Tentou unificar os carros administrativos do Vitor e as viaturas do SVO na mesma tabela sem trava sanitária;*  
  > *2. Sugeriu ignorar o status de `DESINFECCAO` e colocar 6 corpos numa viatura de 4 lugares para 'otimizar rota', além de deixar passar condição de corrida quando dois gestores clicavam juntos;*  
  > *3. E usou `Math.random()` na massa de testes, gerando viagens que chegavam antes de sair e quebravam os gráficos do Dashboard.*  
  > *Nós superamos isso aprendendo que **engenharia de prompt é engenharia de restrições**: evoluímos nossos prompts até a versão 4.0 com restrições negativas explícitas, locks transacionais `FOR UPDATE` no PostgreSQL e geradores matemáticos determinísticos."*

---

### 🚀 TELA 08 — O Próximo Horizonte do ROTA (Evoluções Futuras) (`08:25 – 09:10`)
*(Cobre o item **2.4.a — Evoluções futuras pensadas pela equipe que não foram implementadas**)*

* **O que aparece na tela (4 Cards Visuais com Ícones Grandes):**
  1. ⛽ **Detector de Anomalia Km/L (Cartão Prime)** *(Alerta automático de desvio ou falha mecânica para Vitor)*
  2. 📲 **Guia de Tráfego e Ordem de Coleta com QR Code** *(Validação criptográfica rápida em portarias e blitz)*
  3. ✍️ **Assinatura Digital na Tela do Celular (Signature Pad)** *(No encerramento da viagem, checklist e termo SVO)*
  4. 🗺️ **Mapa de Calor Geoespacial (Heatmap PostGIS)** *(Inteligência logística e epidemiológica para a Diretoria da FSPH)*

* **Sua Fala:**
  > *"Olhando para o pós-MVP na FSPH, já desenhamos quatro evoluções futuras:*  
  > *Para o controle financeiro e mecânico do Vitor, um **Detector Inteligente de Anomalia de Consumo (Km por Litro)** cruzando os abastecimentos do Cartão Prime com o hodômetro das viagens, e a emissão da **Guia Oficial de Tráfego com QR Code verificável** nas portarias.*  
  > *E para a operação de campo, a **Assinatura Digital direto na tela do celular do Fábio** ao encerrar viagens e coletas, além de um **Mapa de Calor Geoespacial em PostGIS** para apoiar a diretoria da FSPH no planejamento logístico e epidemiológico de Sergipe."*

---

### 👥 TELA 09 — Squad 19: Os 10 Engenheiros por Trás do ROTA (`09:10 – 10:00`)
*(Cobre o item **2.4.b — Apresentação de membros da equipe e responsabilidades de cada membro**)*

* **O que aparece na tela:**
  - Os **10 integrantes do Squad 19** em 4 blocos visuais elegantes + A frase de fechamento: *"O caderno ficou fechado. O ROTA está em operação."*

* **Sua Fala Final (`09:10 – 10:00`):**
  > *"E quem fechou o caderno do Vitor e colocou o ROTA de pé foram os **10 integrantes do Squad 19**, atuando em quatro células:*  
  > *- Na **Arquitetura, Governança e Segurança Core**: **Bruno Santana**, responsável pela Trilha de Auditoria LGPD, cancelamento formal de viagens, modelagem e autenticação do Portal Externo SVO, relatórios CSV/PDF, otimização do Dashboard e engenharia de prompts; e **Kennedhy Santos Reis**, responsável pelo Diário Operacional, PWA Offline-First com rotas OSRM e PostGIS, segurança `HttpOnly`/CSRF, avarias e pipeline CI.*  
  > *- No **Cockpit do Vitor e Conservação da Frota**: **Felipe Morais**, na integração do Dashboard, manutenção preventiva com reserva de horário, remanejamento e infraestrutura HML; **Danilo Libório**, no módulo de avarias do checklist e conservação; e **Luiz Mendes**, no desenvolvimento full-stack dos módulos de frota e solicitações.*  
  > *- Nas **Operações Administrativas e Abastecimento**: **João Pedro**, em motoristas, alertas de documentos/CNH e contratos Zod; e **José Matheus**, nos módulos de abastecimento do Cartão Prime, fornecedores e manutenções.*  
  > *- E no **Portal Externo SVO e Qualidade (QA)**: **Anderson Hugo** no back-end de solicitações externas, **Pedro Henrique** no painel do gestor e triagem externa, e **Lizandra** liderando nossa Matriz de QA Exploratória e testes E2E.*  
  > *Nós somos o **Squad 19**. A promessa foi cumprida: o caderno ficou fechado, o Vitor tem o controle de cada viagem institucional e o SVO atende Sergipe com precisão e respeito. Muito obrigado!"*
