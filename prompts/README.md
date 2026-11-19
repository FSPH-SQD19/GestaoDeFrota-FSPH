# Acervo e Rastreabilidade de Prompts — Squad 19 (ROTA / FSPH)

Este diretório contém o repositório oficial e auditável de **Engenharia de Prompt** utilizado pelo **Squad 19** durante a concepção, modelagem, desenvolvimento, testes e blindagem de segurança do sistema **ROTA — Gestão de Frota e SVO** para a **Fundação de Saúde Parreiras Horta (FSPH)**.

Em conformidade com os critérios **1.2 (Documentação de Engenharia de Prompt)**, **1.4 (Versão final do repositório de prompts com rastreabilidade de alterações)** e **1.5 (Exemplos de Prompts que Falharam)** da **Entrega Final — Takeoff (Porto Digital & Unit)**, este acervo é versionado diretamente no Git para que toda a evolução ao longo das sprints possa ser auditada via histórico de commits.

---

## 1. Matriz de Rastreabilidade e Evolução dos Prompts

| ID         | Domínio / Finalidade                                   | Arquivo                                                                            |   Histórico de Versões   | Sprints Cobertas | Técnicas de Prompt Engineering Aplicadas                            |
| :--------- | :----------------------------------------------------- | :--------------------------------------------------------------------------------- | :----------------------: | :--------------: | :------------------------------------------------------------------ |
| **PRM-01** | Arquitetura em Camadas, Concorrência & Schema Prisma   | [`01-arquitetura-e-modelagem.md`](./01-arquitetura-e-modelagem.md)                 | `v1.0` → `v2.1` → `v3.0` |   Sprints 1–11   | Role Prompting, Schema-First, Negative Constraints, Optimistic Lock |
| **PRM-02** | Regras Sanitárias SVO, Capacidade, Remanejamento & SLA | [`02-regras-negocio-e-svo.md`](./02-regras-negocio-e-svo.md)                       | `v1.0` → `v3.0` → `v4.0` |   Sprints 3–11   | Guardrails Sanitários, Few-Shot, State Machine Specification        |
| **PRM-03** | Qualidade, Testes (Vitest/Playwright), CSRF & RBAC     | [`03-qualidade-testes-e-seguranca.md`](./03-qualidade-testes-e-seguranca.md)       | `v1.2` → `v2.2` → `v3.5` |   Sprints 4–11   | Zero-Warning `oxlint`, Security Constraints, E2E Regression Matrix  |
| **PRM-04** | Massa Sintética Determinística & Auditoria LGPD        | [`04-massa-dados-sinteticos-lgpd.md`](./04-massa-dados-sinteticos-lgpd.md)         | `v1.1` → `v2.0` → `v3.0` |   Sprints 2–10   | Synthetic Data Generation, Recursive PII Masking (`sanitizarLgpd`)  |
| **PRM-05** | PWA Motorista Offline, OSRM/PostGIS, Avarias & PDF     | [`05-pwa-motorista-osrm-e-governanca.md`](./05-pwa-motorista-osrm-e-governanca.md) |     `v1.0` → `v2.0`      |   Sprints 6–11   | Offline-First Specification, Geospatial PostGIS/OSRM, Reporting     |

---

## 2. Como Auditar o Histórico de Modificações (Critério 1.4)

Para inspecionar a evolução cronológica e os diffs exatos entre as versões iniciais e a versão final dos prompts diretamente pelo Git, execute na raiz do repositório:

```bash
git log -p --stat -- prompts/ docs/IA_E_ENGENHARIA_DE_PROMPT.md docs/PROMPTS_QUE_FALHARAM.md
```

### Linha do Tempo de Evolução do Acervo:

1. **Fase 1 (Sprints 1 a 3 — Concepção e Fundação)**:
   - Criação dos prompts `v1.0`/`v2.0` focados na separação `Controller -> Service -> Prisma`, modelagem relacional inicial e geração de massa de dados sintéticos (`seed.ts`) sem uso de dados reais de pacientes/falecidos.
2. **Fase 2 (Sprints 4 a 7 — Regras Críticas SVO, Linter Estrito e Sessão Segura)**:
   - Evolução para `v2.2`/`v3.0` após identificação de falhas em prompts genéricos (documentadas em [`../docs/PROMPTS_QUE_FALHARAM.md`](../docs/PROMPTS_QUE_FALHARAM.md)).
   - Adição de restrições negativas explícitas para o `oxlint --deny-warnings`, limite físico de 4 urnas nas viaturas SVO, obrigatoriedade de `DESINFECCAO` pós-coleta e migração para sessões `HttpOnly` + CSRF + rate limiting SHA-256.
3. **Fase 3 (Sprints 8 a 11 — Governança Pública, PWA Geoespacial e Regressão E2E)**:
   - Evolução para `v3.5`/`v4.0` e inclusão do `PRM-05`, cobrindo Trilha de Auditoria com sanitização recursiva LGPD, Cancelamento e Reagendamento com controle de concorrência, Manutenção Preventiva com reserva de horário, Acompanhamento de Avarias, PWA do Motorista com OSRM/PostGIS e Matriz de Regressão E2E com Playwright.

---

## 3. Princípios de Engenharia de Prompt Adotados pelo Squad 19

1. **Context-Rich, Zero-Assumption (Contexto Rico sem Suposições)**:
   - Todo prompt de desenvolvimento fornece explicitamente os trechos relevantes do `schema.prisma`, contratos de erro (`HttpError`) e perfis RBAC da FSPH.
2. **Determinismo Acima da Inferência Estatística em Produção**:
   - Em saúde pública e logística de óbitos (SVO), regras sanitárias e permissões nunca ficam a cargo de decisão probabilística de LLM em runtime; a IA é utilizada na engenharia para sintetizar código TypeScript determinístico validado por schemas Zod e testes automatizados.
3. **Negative Constraints (Restrições Negativas Explícitas)**:
   - Proibição expressa de `any`, `@ts-ignore`, mutações fora de transação, exposição de hashes/tokens em logs e `setState` síncrono em `useEffect`.
4. **Privacidade e Conformidade LGPD by Design**:
   - Nenhum dado pessoal ou clínico real da FSPH foi submetido a modelos externos. Toda a homologação utiliza geradores sintéticos determinísticos e mascaramento recursivo.

---

## 4. Documentos Relacionados da Entrega Final

- [`../docs/IA_E_ENGENHARIA_DE_PROMPT.md`](../docs/IA_E_ENGENHARIA_DE_PROMPT.md): Documentação completa de Integrações de IA, Ferramentas Utilizadas, Arquitetura de Guardrails e Análise de Custo e Viabilidade Econômica (Critérios **1.2**, **2.2** e **2.3**).
- [`../docs/PROMPTS_QUE_FALHARAM.md`](../docs/PROMPTS_QUE_FALHARAM.md): Documento executivo (1 página) relatando exemplos reais de prompts que falharam, como foram ajustados e como a equipe validou o output da IA (Critério **1.5**).
