# Acervo e Rastreabilidade de Prompts — Squad 19 (ROTA / FSPH)

Este diretório contém o repositório auditável de **Engenharia de Prompt** utilizado pelo **Squad 19** durante a concepção, modelagem, desenvolvimento e garantia de qualidade do sistema **ROTA — Gestão de Frota e SVO** para a **Fundação de Saúde Parreiras Horta (FSPH)**.

Em conformidade com os critérios **1.2 (Documentação de Engenharia de Prompt)**, **1.4 (Repositório de Prompts com Rastreabilidade)** e **1.5 (Exemplos de Prompts que Falharam)** da **Entrega Final — Takeoff (Porto Digital & Unit)**, este acervo documenta a evolução dos prompts, técnicas de contextualização aplicadas, guardrails determinísticos e lições aprendidas.

---

## 1. Matriz de Rastreabilidade e Evolução dos Prompts

| ID         | Domínio / Finalidade                | Arquivo                                                                      | Versão Atual | Sprint / Data | Técnicas Empregadas                                  |
| :--------- | :---------------------------------- | :--------------------------------------------------------------------------- | :----------: | :-----------: | :--------------------------------------------------- |
| **PRM-01** | Arquitetura & Modelagem Prisma      | [`01-arquitetura-e-modelagem.md`](./01-arquitetura-e-modelagem.md)           |    `v2.1`    |  Sprint 1-2   | Role Prompting, Schema-First, Constraints PostGIS    |
| **PRM-02** | Regras de Negócio & SVO             | [`02-regras-negocio-e-svo.md`](./02-regras-negocio-e-svo.md)                 |    `v3.0`    |  Sprint 3-4   | Few-Shot, Guardrails Sanitários, Chain-of-Thought    |
| **PRM-03** | Qualidade, Testes & Linting Estrito | [`03-qualidade-testes-e-seguranca.md`](./03-qualidade-testes-e-seguranca.md) |    `v2.2`    |  Sprint 4-5   | Negative Constraints, Zero-Warning `oxlint`, Mocking |
| **PRM-04** | Massa Sintética de Dados & LGPD     | [`04-massa-dados-sinteticos-lgpd.md`](./04-massa-dados-sinteticos-lgpd.md)   |    `v2.0`    |  Sprint 2-3   | Synthetic Data Generation, Anonimização LGPD         |

---

## 2. Princípios de Engenharia de Prompt Adotados pela Equipe

1. **Context-Rich, Zero-Assumption (Contexto Rico sem Suposições)**:
   - Fornecimento explícito de schemas Prisma, interfaces TypeScript e enums do domínio de saúde pública da FSPH.
2. **Determinismo Acima da Criatividade**:
   - Para regras críticas (ex.: capacidade máxima de 4 urnas na viatura SVO, limite de CNH vencida, transições de status da frota), os prompts instruíram modelos a gerar **código determinístico** em TypeScript/Prisma, sem delegar a decisão em runtime para inferência estatística.
3. **Negative Constraints (Restrições Negativas)**:
   - Instruções proibindo terminantemente padrões que ferem a arquitetura do projeto (ex.: não usar `@ts-ignore`, não violar regras do `oxlint --deny-warnings`, não alterar tabelas de auditoria sem transação).
4. **Privacidade e LGPD**:
   - Prompts de geração de dados e testes utilizam apenas dados 100% sintéticos (geradores determinísticos de CPF válido de teste, nomes de municípios sergipanos reais com hospitais e endereços fictícios).

---

## 3. Estrutura do Diretório

- [`01-arquitetura-e-modelagem.md`](./01-arquitetura-e-modelagem.md): Prompts de estruturação de rotas, controllers, services, middlewares RBAC e schemas Prisma.
- [`02-regras-negocio-e-svo.md`](./02-regras-negocio-e-svo.md): Prompts específicos do fluxo de remoção de corpos do SVO, higienização, plantões de motoristas e triagem clínica.
- [`03-qualidade-testes-e-seguranca.md`](./03-qualidade-testes-e-seguranca.md): Prompts para testes unitários com Vitest, React Testing Library e prevenção de falhas de concorrência.
- [`04-massa-dados-sinteticos-lgpd.md`](./04-massa-dados-sinteticos-lgpd.md): Prompts de geração do `seed.ts` e `seed-demo.ts` para homologação e apresentação à banca.
- [`../docs/PROMPTS_QUE_FALHARAM.md`](../docs/PROMPTS_QUE_FALHARAM.md): Relatório de 1 página exigido pelo edital com os prompts que apresentaram falhas ou alucinações e como foram corrigidos.
- [`../docs/IA_E_ENGENHARIA_DE_PROMPT.md`](../docs/IA_E_ENGENHARIA_DE_PROMPT.md): Documento técnico consolidado da governança de IA.
