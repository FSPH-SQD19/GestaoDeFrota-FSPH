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
2. Use nomes fictícios completos convincentes (ex: "Carlos Eduardo da Silva", "Mariana Oliveira Santos").
3. Para CPFs, utilize gerador determinístico com algoritmo de dígitos verificadores válidos baseado em faixas reservadas de teste.
4. Para óbitos do SVO, use identificadores codificados (ex: "Declaração de Óbito nº 32.891.442-0"), causas naturais clínicas plausíveis (CID-10 I21.9, I64, J18.9) e hospitais reais do SUS de Sergipe (HUSE, Hospital Regional de Lagarto, UPA Fernando Franco).

VOLUME DA MASSA SINTÉTICA:

- 10 Usuários distribuídos nos perfis: 2 ADMIN, 3 GESTOR, 3 MOTORISTA, 2 SOLICITANTE.
- 7 Veículos representativos da frota real comunicada pelo gestor (Chevrolet S10 cabine dupla do SVO, Vans Master para transporte assistencial, sedãs leves para administração), com placas no padrão Mercosul e odômetros coerentes.
- 15 Viagens com histórico variado: 4 PENDENTES para triagem, 2 EM_TRANSITO, 7 CONCLUIDAS com checklists e km preenchidos, 2 REJEITADAS com justificativa.
- 8 Chamados SVO: com fluxos completos de triagem, despacho de viatura refrigerada, coleta e desinfecção pós-retorno.
- Documentos de veículos com diferentes status: regulares, vencendo nos próximos 15 dias (para acionar alerta no Header) e 1 vencido.
```

---

## 2. Prompt de Anonimização e Higienização de Dados em Trânsito

### Versão: `v1.1`

#### Prompt Utilizado:

```markdown
Crie uma função utilitária `sanitizarDadosOperacionais(dados)` para logs e payloads:

1. Mascarar CPFs: exibir apenas '***.456.789-**'.
2. Remover telefones e emails de familiares solicitantes em chamados do SVO de qualquer log de auditoria ou console.
3. Não registrar senhas, tokens JWT ou hashes nos logs de erro.
4. Manter visíveis apenas identificadores técnicos não sensíveis: IDs, protocolos de chamado, placas de veículos institucionais e datas.
```
