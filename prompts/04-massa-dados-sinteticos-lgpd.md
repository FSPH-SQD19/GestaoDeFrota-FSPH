# Prompts — Geração de Massa de Dados Sintéticos e LGPD (PRM-04)

Este documento registra os prompts utilizados para alimentar o banco de dados de desenvolvimento e homologação (`prisma/seed.ts` e `seed-demo.ts`) com dados operacionais realistas da saúde pública de Sergipe, respeitando rigorosamente a **Lei Geral de Proteção de Dados (LGPD)**.

---

## 1. Prompt de Geração do Seed Realista da FSPH e SVO Sergipe

### Versão: `v2.0`

#### Contexto Operacional:

A Fundação de Saúde Parreiras Horta (FSPH) é sediada em Aracaju/SE e atende a Rede Hospitalar Estadual (HUSE - Hospital de Urgências de Sergipe Governador João Alves Filho, Maternidade Nossa Senhora de Lourdes, Hospital Regional de Itabaiana, Lagarto, Estância, Glória, Propriá). O seed precisa refletir essa geografia e volume real com 100% de dados anonimizados.

#### Prompt Utilizado:

```markdown
Atue como Engenheiro de Dados e Especialista em LGPD para o Sistema de Saúde de Sergipe (FSPH).

Gere um script TypeScript (`seed-demo.ts`) para popular o banco via Prisma com dados operacionais realistas para a banca de avaliação da residência:

DIRETRIZES DE PRIVACIDADE E LGPD:

1. NUNCA use CPFs, nomes de pessoas reais, números de telefone reais ou prontuários médicos reais.
2. Use contas de demonstração claramente identificadas (`@demo.frota.test`) e nomes fictícios.
3. Para CPFs, utilize gerador determinístico com algoritmo de dígitos verificadores válidos baseado em faixas reservadas de teste.
4. Para óbitos do SVO, use identificadores codificados, causas naturais clínicas plausíveis e hospitais reais do SUS de Sergipe (HUSE, Hospital Regional de Lagarto, UPA Fernando Franco).

VOLUME DA MASSA SINTÉTICA:

- Usuários distribuídos nos perfis operacionais: ADMIN, GESTOR, MOTORISTA, SVO e SOLICITANTE.
- Veículos representativos da frota real comunicada pelo gestor (viaturas SVO e veículos administrativos), com placas no padrão Mercosul e odômetros coerentes.
- Viagens com histórico variado (PENDENTE, APROVADA, EM_TRANSITO, CONCLUIDA, RECUSADA).
- Chamados SVO com fluxos completos de triagem, despacho de viatura, coleta e desinfecção pós-retorno.
- Documentos de veículos e CNHs com diferentes status: vigentes, próximos do vencimento (janela de 30 dias) e vencidos.
```

---

## 2. Prompt de Anonimização e Higienização de Dados em Trânsito

### Versão: `v1.1`

#### Prompt Utilizado:

```markdown
Crie uma função utilitária de sanitização recursiva para logs e payloads de auditoria:

1. Mascarar campos sensíveis como senhas, hashes, tokens, secrets e credenciais com '******'.
2. Não registrar senhas em texto puro, cookies de sessão ou tokens JWT nos logs de erro ou na tabela `auditoria_sistema`.
3. Manter visíveis apenas identificadores técnicos e metadados operacionais necessários para rastreabilidade e governança pública.
```
