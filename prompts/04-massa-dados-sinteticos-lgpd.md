# Prompts — Massa de Dados Sintéticos, Governança e Trilha de Auditoria LGPD (PRM-04)

Este documento registra os prompts utilizados para alimentar o banco de dados de desenvolvimento e homologação (`prisma/seed.ts` e `seed-demo.ts`) com dados sintéticos da saúde pública de Sergipe e para implementar a **Trilha de Auditoria com Sanitização LGPD**.

---

## 1. Prompt de Geração do Seed Determinístico da FSPH e SVO Sergipe

### Versão: `v2.0` -> `v3.0`

#### Contexto Operacional:

A Fundação de Saúde Parreiras Horta (FSPH) é sediada em Aracaju/SE e coordena unidades estratégicas como o **HEMOSE**, o **LACEN** e o **SVO**. O script `seed-demo.ts` precisa gerar uma massa 100% determinística, idempotente e livre de dados pessoais reais.

#### Prompt Utilizado:

```markdown
Atue como Engenheiro de Dados e Especialista em LGPD para o Sistema de Saúde de Sergipe (FSPH).

Evolua o script TypeScript (`BackEnd/prisma/seed-demo.ts`) para popular o banco via Prisma com dados operacionais realistas para homologação e demonstração à banca:

DIRETRIZES DE PRIVACIDADE, SEGURANÇA E IDEMPOTÊNCIA:

1. NUNCA use CPFs, nomes de pessoas reais, números de telefone reais ou prontuários médicos reais.
2. Gere UUIDs determinísticos via hash SHA-256 (`frota-demo-v1:${chave}`) para que o seed possa ser reexecutado sem duplicar registros.
3. Não versione senhas fixas em código aberto: gere ou reutilize a senha de demonstração localmente em `BackEnd/.runtime/demo-access.json` (ignorado pelo Git) e bloqueie a execução se `NODE_ENV === "production"`.
4. Contemple todos os cenários operacionais:
   - Contas de demonstração para todos os perfis (`admin`, `gestor`, `motorista`, `svo`, `solicitante`, `motorista.svo`, `motorista.reserva`).
   - Frota Administrativa e Frota SVO (própria e locada, com sedes, odômetros e limites de revisão preventiva).
   - Documentos veiculares (CRLV, IPVA, SEGURO, VISTORIA) e CNHs vigentes, vencendo em até 30 dias e vencidos.
   - Solicitações de viagem, execuções, abastecimentos, manutenções, multas e chamados SVO com cálculo de SLA.
```

---

## 2. Prompt da Trilha de Auditoria Administrativa e Sanitização Recursiva LGPD

### Versão: `v1.1` -> `v3.0` (Sprint 10 — `S19FROTA-259`)

#### Contexto:

O sistema grava registros imutáveis em `AuditoriaSistema` para todas as ações críticas. Para expor essa consulta na interface de governança restrita ao perfil `ADMIN`, foi necessário garantir sanitização recursiva de qualquer campo sensível em `dadosNovos`.

#### Prompt Utilizado:

```markdown
Implemente o serviço `listarAuditoria` e `sanitizarLgpd` em `BackEnd/src/service/auditoria_s.ts` e a interface `AuditoriaPage.tsx` + `DetalhesAuditoriaModal.tsx`:

1. Controle de Acesso Estrito:
   - O endpoint `GET /api/v1/auditoria` deve ser exclusivo do perfil `ADMIN` (`requireRole("ADMIN")`), retornando 401 para não autenticados e 403 para demais perfis (`GESTOR`, `SVO`, `MOTORISTA`, `SOLICITANTE`).
2. Sanitização Recursiva LGPD (`sanitizarLgpd`):
   - Percorrer recursivamente objetos e arrays do payload `dadosNovos`.
   - Mascarar com `"******"` qualquer chave sensível (`senha`, `senhaHash`, `senha_hash`, `password`, `token`, `novaSenha`, `senhaAtual`, `secret`), independentemente do nível de aninhamento.
3. Filtros e Paginação:
   - Permitir filtragem combinada por módulo/tabela (`tabelaAfetada`), tipo de ação (`acao`), usuário responsável (`usuarioId`), intervalo de datas (`dataInicio`, `dataFim` no fuso `-03:00`) e busca textual livre, além de retornar contagens agregadas por tipo de ação (`CRIAR`, `ATUALIZAR`, `EXCLUIR`).
```
