# Identidade visual — ROTA (FSPH)

[Índice da documentação](README.md)

Guia oficial de marca, cores, tipografia e diretrizes de aplicação para a plataforma **ROTA**, desenvolvida pelo **Squad 19** para a **Fundação de Saúde Parreiras Horta (FSPH)** no programa Takeoff.

## Marca ROTA

O **ROTA** é o projeto de sistema web para centralização, despacho e rastreabilidade da frota administrativa (LACEN, Hemose, SES, Diretoria) e da frota especializada do SVO (Serviço de Verificação de Óbito) da FSPH. O conceito de marca considera aplicações web e PWA mobile.

* **Nome Oficial:** ROTA (ou ROTA FSPH)
* **Assinatura de Marca:** Gestão de Frota e SVO
* **Atributos da Marca:** Confiabilidade pública, precisão logística, rastreabilidade em tempo real e biossegurança.

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

| Nome da Cor | Amostra | HEX | RGB | CMYK | Aplicação |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Rota Blue** | 🟦 | `#2563EB` | `37, 99, 235` | `84, 58, 0, 8` | Cor principal, botões de ação e destaques |
| **Rota Sky Cyan**| 🩵 | `#38BDF8` | `56, 189, 248` | `77, 24, 0, 3` | Núcleo GPS, foco, brilhos e tags ativas |
| **Rota Deep Navy**| ⬛ | `#0A0D14` | `10, 13, 20` | `50, 35, 0, 92`| Fundo da Sidebar flutuante, header e modo dark |
| **Rota Indigo** | 🟣 | `#4F46E5` | `79, 70, 229` | `66, 69, 0, 10`| Transições e faixas secundárias do loop |

### Cores funcionais da frota

| Status | Amostra | HEX | Significado Operacional |
| :--- | :---: | :---: | :--- |
| **Disponível (Emerald)** | 🟢 | `#10B981` | Viaturas prontas para saída imediata e checklists aprovados |
| **Em Viagem (Sapphire)** | 🔵 | `#2563EB` | Veículos em trânsito com condutor escalado |
| **Pendente / Alerta (Amber)**| 🟡 | `#F59E0B` | Solicitações aguardando gestor, CNH/IPVA a vencer e revisões |
| **SVO / Desinfecção (Coral)**| 🔴 | `#E11D48` | Chamados de óbito e quarentena sanitária biológica obrigatória |

### Tokens usados pela interface

As paletas acima preservam as referências de marca e os valores RGB/CMYK do material original. Os tokens de implementação em `FrontEnd/src/index.css` usam variações para aplicação na interface:

| Token | HEX |
| --- | --- |
| `--color-rota-cobalt` | `#2563EB` |
| `--color-rota-cyan` | `#0EA5E9` |
| `--color-rota-indigo` | `#4F46E5` |
| `--color-status-available` | `#059669` |
| `--color-status-transit` | `#2563EB` |
| `--color-status-pending` | `#D97706` |
| `--color-status-quarantine` | `#E11D48` |
| `--color-sidebar-bg` | `#090D16` |
| `--color-sidebar-surface` | `#121826` |
| `--color-sidebar-hover` | `#1E2638` |

Consulte [Front-end](FRONTEND.md#cores-semânticas) para as classes semânticas e a aplicação da logo na barra lateral.

## Tipografia

A tipografia padrão do ecossistema ROTA é a **Space Grotesk** (Google Fonts), escolhida por suas formas geométricas técnicas e alta legibilidade para placas, hodômetros e códigos de solicitação:

* **Títulos e Wordmark:** `Space Grotesk Bold (700)` ou `ExtraBold (800)`
* **Menus e Elementos de Interface:** `Space Grotesk SemiBold (600)`
* **Métricas e Dados Numéricos:** `Space Grotesk Bold (700)`
* **Textos Corridos e Legendas:** `Space Grotesk Regular (400)`

O `FrontEnd/index.html` carrega os pesos 300, 400, 500, 600 e 700. O peso 800 é uma referência gráfica para composições da marca.

## Arquivos e formatos

Todos os arquivos vetoriais de produção estão salvos e versionados no repositório em:
[`FrontEnd/src/assets/branding/rota/`](../FrontEnd/src/assets/branding/rota/)

| Arquivo | Descrição | Uso Recomendado |
| :--- | :--- | :--- |
| `rota-symbol-color.svg` | Símbolo oficial com gradientes vibrantes | Telas claras, cards brancos e crachás |
| `rota-symbol-dark.svg` | Símbolo com gradientes de alta luminosidade (ciano/íris) | Telas escuras e fundos com baixa iluminação |
| `rota-symbol-white.svg` | Símbolo monocromático branco | Superfícies escuras, uniformes e carimbos |
| `rota-symbol-black.svg` | Símbolo monocromático preto | Documentos impressos em papel sulfite |
| `rota-lockup-horizontal.svg` | Símbolo + Wordmark ROTA + Subtítulo | Cabeçalhos de relatórios e telas claras |
| `rota-lockup-horizontal-white.svg`| Lockup horizontal para fundos escuros | Banners de apresentação e telas escuras |
| [`favicon.svg`](../FrontEnd/public/favicon.svg) | Ícone da aba do navegador, fora da pasta de branding | Arquivo usado pelo `FrontEnd/index.html` |

O favicon fica em `FrontEnd/public/favicon.svg`. Os SVGs da marca são vetoriais e podem ser redimensionados mantendo a proporção.

## Regras de aplicação

* **Área de Proteção:** Mantenha sempre um espaço livre ao redor do logo equivalente a `0.5X` (metade da altura do símbolo), livre de outros textos ou ícones.
* **Tamanho Mínimo Digital:**
  * Lockup completo: mínimo de `140px` de largura.
  * Símbolo isolado (Favicon/PWA): legível a partir de `16px × 16px`.
* **Proibições:**
  * ❌ Nunca distorça horizontal ou verticalmente a proporção do símbolo.
  * ❌ Nunca troque as cores do gradiente por cores aleatórias.
  * ❌ Nunca adicione sombras projetadas pesadas estilo anos 2000.
  * ❌ Nunca aplique o símbolo colorido sobre fundos com baixo contraste (use a versão branca sobre fundos escuros ou preta sobre fundos coloridos saturados).

A aplicação da versão colorida dentro de um contêiner branco, usada no menu escuro, segue a orientação de [Front-end](FRONTEND.md#aplicação-da-logo-rota).

## Contexto das diretrizes

As referências a biossegurança, rastreamento em tempo real, checklists, quarentena e à Portaria MS nº 1.405 fazem parte do contexto original do conceito visual e do escopo previsto. O material original não identifica a data ou o dispositivo específico da Portaria. A referência deve ser confirmada na especificação de requisitos antes de orientar regras operacionais.

Este manual documenta a marca. Consulte [Projeto](PROJETO.md) para entender a proposta do sistema e [Back-end](BACKEND.md) para os contratos e as regras da API.
