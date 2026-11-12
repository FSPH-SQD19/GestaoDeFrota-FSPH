# Identidade visual — ROTA (FSPH)

[Índice da documentação](README.md)

Guia oficial de marca, cores, tipografia e diretrizes de aplicação para a plataforma **ROTA**, desenvolvida pelo **Squad 19** para a **Fundação de Saúde Parreiras Horta (FSPH)** no programa Takeoff.

## Marca ROTA

O **ROTA** é o projeto de sistema web para centralização, despacho e rastreabilidade da frota administrativa (LACEN, Hemose, SES, Diretoria) e da frota especializada do SVO (Serviço de Verificação de Óbito) da FSPH. O conceito de marca considera aplicações web e PWA mobile.

- **Nome Oficial:** ROTA (ou ROTA FSPH)
- **Assinatura de Marca:** Gestão de Frota e SVO
- **Atributos da Marca:** Confiabilidade pública, precisão logística, rastreabilidade em tempo real e biossegurança.

## Anatomia do símbolo: o loop contínuo

O símbolo do **ROTA** foi desenhado com geometria vetorial pura (`viewBox="0 0 256 256"`), baseado em simetria rotacional de 180°:

```text
       ┌─────────── Pista de Saída / Despacho (Azul Safira)
       │    ┌────── Núcleo de Rastreamento GPS e Sincronização (Ciano / Branco)
       ▼    ▼
     ╭────────╮
    │  ╭──╮   │
    │  │● │   │
    │   ╰─╯   │
     ╰────────╯
          ▲
          └──────── Pista de Retorno / Biossegurança SVO (Índigo Profundo)
```

1. **Pista Superior (Azul Safira / Cyan):** Representa a saída institucional, o despacho rápido e o transporte de equipes e amostras biológicas.
2. **Pista Inferior (Índigo Profundo / SVO):** Representa o percurso de volta, a triagem médica e a **desinfecção sanitária** da viatura. O material original associa esse conceito à Portaria MS nº 1.405; veja [Contexto das diretrizes](#contexto-das-diretrizes).
3. **Núcleo Central Iluminado (Ciano / Ponto GPS):** O ponto focal que simboliza georreferenciamento em tempo real e monitoramento contínuo da frota.

## Paleta de cores

### Cores primárias da marca

| Nome da Cor        | Amostra |    HEX    |      RGB       |      CMYK       | Aplicação                                       |
| :----------------- | :-----: | :-------: | :------------: | :-------------: | :---------------------------------------------- |
| **Rota Blue**      |   🟦    | `#1D4ED8` | `29, 78, 216`  | `87, 64, 0, 15` | Destaque institucional, foco e indicadores      |
| **Rota Sky Cyan**  |   🩵    | `#38BDF8` | `56, 189, 248` | `77, 24, 0, 3`  | Núcleo vetorial da marca ROTA                   |
| **Rota Deep Navy** |   ⬛    | `#0B0F17` |  `11, 15, 23`  | `52, 35, 0, 91` | Fundo da Sidebar e botões primários (`#0F172A`) |
| **Rota Indigo**    |   🟣    | `#4F46E5` | `79, 70, 229`  | `66, 69, 0, 10` | Faixa secundária exclusiva do símbolo vetorial  |

### Cores funcionais da frota

| Status                        | Amostra |    HEX    | Significado Operacional                                        |
| :---------------------------- | :-----: | :-------: | :------------------------------------------------------------- |
| **Disponível (Emerald)**      |   🟢    | `#047857` | Viaturas prontas para saída imediata e checklists aprovados    |
| **Em Viagem (Sapphire)**      |   🔵    | `#1D4ED8` | Veículos em trânsito com condutor escalado                     |
| **Pendente / Alerta (Amber)** |   🟡    | `#B45309` | Solicitações aguardando gestor, CNH/IPVA a vencer e revisões   |
| **SVO / Desinfecção (Coral)** |   🔴    | `#BE123C` | Chamados de óbito e quarentena sanitária biológica obrigatória |

### Tokens usados pela interface (`FrontEnd/src/index.css`)

Os tokens CSS centralizam superfícies, bordas, textos e estados semânticos para evitar variações ad-hoc entre telas:

| Token                       | HEX       | Papel na Interface                                    |
| --------------------------- | --------- | ----------------------------------------------------- |
| `--color-surface-canvas`    | `#F6F7F9` | Plano de fundo geral da aplicação                     |
| `--color-surface-card`      | `#FFFFFF` | Superfície de cards, tabelas e modais                 |
| `--color-surface-muted`     | `#F1F3F6` | Cabeçalhos de tabela e barras segmentadas             |
| `--color-border-subtle`     | `#E2E8F0` | Bordas estruturais de cards e divisores (`slate-200`) |
| `--color-border-strong`     | `#CBD5E1` | Bordas de controles e inputs (`slate-300`)            |
| `--color-text-primary`      | `#0F172A` | Títulos, métricas e dados principais (`slate-900`)    |
| `--color-text-secondary`    | `#475569` | Textos de apoio e células secundárias (`slate-600`)   |
| `--color-text-muted`        | `#64748B` | Rótulos auxiliares e legendas (`slate-500`)           |
| `--color-rota-cobalt`       | `#1D4ED8` | Cor de destaque institucional e estados ativos        |
| `--color-status-available`  | `#047857` | Disponível / Aprovado / Concluído                     |
| `--color-status-transit`    | `#1D4ED8` | Em viagem / Em andamento                              |
| `--color-status-pending`    | `#B45309` | Pendente / Em análise / Vencimento próximo            |
| `--color-status-quarantine` | `#BE123C` | Desinfecção SVO / Urgente / Vencido / Recusado        |
| `--color-sidebar-bg`        | `#0B0F17` | Fundo da barra lateral de navegação                   |
| `--color-sidebar-surface`   | `#111827` | Superfície interna da barra lateral                   |
| `--color-sidebar-hover`     | `#1E293B` | Estado ativo/hover de itens na barra lateral          |

Consulte [Front-end](FRONTEND.md#identidade-visual-e-componentes) para as regras de geometria, tipografia e uso dos componentes base.

## Tipografia

O sistema combina duas famílias tipográficas carregadas em `FrontEnd/index.html` e atribuídas aos tokens `--font-sans` e `--font-mono`:

- **Interface e Títulos (`--font-sans: "Plus Jakarta Sans"`):**
  - Títulos de página (`h1`): `24px–26px`, `font-bold (700)`, `tracking-tight`
  - Títulos de seção/card (`h2`, `h3`): `14px–16px`, `font-semibold (600)`
  - Rótulos de campos e cabeçalhos de tabela: `11px–12px`, `font-semibold (600)`
  - Corpo de dados e formulários: `13px–14px`, `font-normal (400)` / `font-medium (500)`
- **Dados Técnicos (`--font-mono: "JetBrains Mono"` + `tabular-nums`):**
  - Placas Mercosul/antigas (`QMA4J28`), protocolos (`SOL-2026-0001`, `SVO-2026-0001`), números de CNH, CPF, odômetros e horários de turno.
  - Todas as tabelas, listas de definição (`dd`) e indicadores numéricos aplicam `font-variant-numeric: tabular-nums` globalmente para alinhamento vertical.

## Arquivos e formatos

Todos os arquivos vetoriais de produção estão salvos e versionados no repositório em:
[`FrontEnd/src/assets/branding/rota/`](../FrontEnd/src/assets/branding/rota/)

| Arquivo                                         | Descrição                                                | Uso Recomendado                             |
| :---------------------------------------------- | :------------------------------------------------------- | :------------------------------------------ |
| `rota-symbol-color.svg`                         | Símbolo oficial com gradientes vibrantes                 | Telas claras, cards brancos e crachás       |
| `rota-symbol-dark.svg`                          | Símbolo com gradientes de alta luminosidade (ciano/íris) | Telas escuras e fundos com baixa iluminação |
| `rota-symbol-white.svg`                         | Símbolo monocromático branco                             | Superfícies escuras, uniformes e carimbos   |
| `rota-symbol-black.svg`                         | Símbolo monocromático preto                              | Documentos impressos em papel sulfite       |
| `rota-lockup-horizontal.svg`                    | Símbolo + Wordmark ROTA + Subtítulo                      | Cabeçalhos de relatórios e telas claras     |
| `rota-lockup-horizontal-white.svg`              | Lockup horizontal para fundos escuros                    | Banners de apresentação e telas escuras     |
| [`favicon.svg`](../FrontEnd/public/favicon.svg) | Ícone da aba do navegador, fora da pasta de branding     | Arquivo usado pelo `FrontEnd/index.html`    |

O favicon fica em `FrontEnd/public/favicon.svg`. Os SVGs da marca são vetoriais e podem ser redimensionados mantendo a proporção.

## Regras de aplicação

- **Área de Proteção:** Mantenha sempre um espaço livre ao redor do logo equivalente a `0.5X` (metade da altura do símbolo), livre de outros textos ou ícones.
- **Tamanho Mínimo Digital:**
  - Lockup completo: mínimo de `140px` de largura.
  - Símbolo isolado (Favicon/PWA): legível a partir de `16px × 16px`.
- **Proibições:**
  - ❌ Nunca distorça horizontal ou verticalmente a proporção do símbolo.
  - ❌ Nunca troque as cores do gradiente por cores aleatórias.
  - ❌ Nunca adicione sombras projetadas pesadas estilo anos 2000.
  - ❌ Nunca aplique o símbolo colorido sobre fundos com baixo contraste (use a versão branca sobre fundos escuros ou preta sobre fundos coloridos saturados).

A aplicação da versão colorida dentro de um contêiner branco, usada no menu escuro, segue a orientação de [Front-end](FRONTEND.md#aplicação-da-logo-rota).

## Contexto das diretrizes

As referências a biossegurança, rastreamento em tempo real, checklists, quarentena e à Portaria MS nº 1.405 fazem parte do contexto original do conceito visual e do escopo previsto. O material original não identifica a data ou o dispositivo específico da Portaria. A referência deve ser confirmada na especificação de requisitos antes de orientar regras operacionais.

Este manual documenta a marca. Consulte [Projeto](PROJETO.md) para entender a proposta do sistema e [Back-end](BACKEND.md) para os contratos e as regras da API.
