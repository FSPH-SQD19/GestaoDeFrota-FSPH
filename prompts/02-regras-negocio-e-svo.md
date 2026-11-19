# Prompts — Regras de Negócio e Serviço de Verificação de Óbito (PRM-02)

Este documento registra os prompts utilizados para traduzir as particularidades sanitárias, regulatórias e logísticas do **Serviço de Verificação de Óbito (SVO)** da FSPH em regras de negócio determinísticas no sistema **ROTA**.

---

## 1. Prompt de Triagem Telefônica e Critérios de Elegibilidade (SVO vs. IML)

### Versão: `v3.0`

#### Contexto Operacional:

O SVO atende exclusivamente **óbitos de causa natural** (sem assistência médica ou com causa mal definida). Casos com suspeita de causa externa (trauma, acidente, agressão, suicídio, afogamento, envenenamento) são de competência exclusiva do **Instituto Médico Legal (IML)** da Polícia Científica. Encaminhar um caso de causa externa ao SVO constitui infração legal e sanitária grave.

#### Prompt Utilizado:

```markdown
Atue como Especialista em Protocolos Sanitários do Sistema Único de Saúde (SUS) e Regulação de Óbitos do SVO Estadual de Sergipe (FSPH).

Você receberá um relato com as circunstâncias do óbito colhidas durante o acionamento por hospitais, UPAs, SAMU ou familiares.

REGRAS DE CLASSIFICAÇÃO:

1. ELEGÍVEL_SVO:
   - Óbito domiciliar ou em unidade de saúde decorrente de causas naturais sem assistência médica recente ou com necessidade de elucidação diagnóstica.
2. ENCAMINHAMENTO_IML (Recusa SVO):
   - Qualquer indício de violência, trauma, acidente de trânsito, lesão por arma de fogo/branca, intoxicação exógena aguda, asfixia, queimadura ou morte suspeita.
3. INSUFICIENCIA_DADOS:
   - Quando faltarem informações essenciais de identificação, local da ocorrência ou circunstâncias preliminares, exigindo complementação antes da decisão.

REGRAS DE IMPLEMENTAÇÃO NO BACK-END (`svo_s.ts`):
- Toda recusa na triagem exige justificativa obrigatória validada via Zod (`superRefine`).
- Toda decisão de triagem gera registro na trilha de auditoria (`auditoria_sistema`).
```

---

## 2. Prompt de Alocação de Viatura SVO, Capacidade e Desinfecção Obrigatória

### Versão: `v2.2` -> `v3.5`

#### Contexto:

As viaturas de remoção do SVO possuem capacidade máxima configurada (padrão de **4 urnas/corpos**). Após concluir a última coleta ativa, a viatura deve obrigatoriamente entrar em status `DESINFECCAO` por protocolo sanitário da ANVISA antes de voltar a ficar `DISPONIVEL`.

#### Prompt Utilizado:

```markdown
Implemente e evolua as funções de emissão, avanço de etapa, remanejamento e conclusão de ordem de coleta dentro de `svo_s.ts`.

REGRAS DE NEGÓCIO DA FSPH:

1. Elegibilidade da Viatura e Motorista:
   - A viatura deve pertencer à frota 'SVO', estar ativa e com status 'DISPONIVEL' (ou já alocada à mesma equipe dentro do limite de capacidade).
   - Viaturas em 'DESINFECCAO', 'MANUTENCAO' ou 'INATIVO' ou com documentos vencidos bloqueiam o despacho com HttpError 400/409.
   - O motorista deve estar ativo, disponível e com CNH vigente.
2. Controle de Capacidade:
   - A soma de ordens de coleta ativas (`AGUARDANDO_DESPACHO`, `EM_DESLOCAMENTO`, `NO_LOCAL`) na viatura NÃO pode ultrapassar `capacidadeMaxima`.
3. Remanejamento Operacional em Andamento:
   - Caso ocorra intercorrência mecânica ou operacional durante a coleta, permitir o remanejamento de viatura e/ou motorista exigindo motivo obrigatório, preservando a rastreabilidade em `auditoria_sistema` e liberando o recurso substituído caso não possua outras coletas ativas.
4. Conclusão e Ciclo Sanitário de Desinfecção:
   - Ao entregar o corpo no SVO (`ENTREGUE_SVO`), se não restarem coletas ativas naquela viatura, transitar o veículo automaticamente para 'DESINFECCAO' e abrir registro em `DesinfeccaoSvo`.
   - Disparar notificação operacional ao concluir a desinfecção e liberar a viatura para 'DISPONIVEL'.
```

---

## 3. Prompt de Cálculo de SLA de Resposta e Entrega do SVO

### Versão: `v4.0` (Sprint 10)

#### Contexto eEvolução:

Necessidade de medir o tempo real de resposta da operação SVO sem fabricar ou distorcer médias com registros legados sem timestamp de abertura.

#### Prompt Utilizado:

```markdown
Implemente o cálculo de SLA do módulo SVO (`obterSlaRespostaSvo` em `svo_s.ts` e utilitários em `FrontEnd/src/lib/svoSla.ts`):

1. SLA de Resposta (minutos): diferença entre `chamado.criadoEm` e `ordemColeta.dataHoraChegadaLocal`.
2. SLA de Entrega (minutos): diferença entre `chamado.criadoEm` e `ordemColeta.dataHoraEntregaSvo`.
3. Regra de Integridade:
   - Considerar apenas registros que possuam ambos os timestamps válidos e `fim >= inicio`.
   - Chamados legados sem `criadoEm` permanecem com SLA `null` (desconhecido), nunca fabricando zero artificial na média do Dashboard.
```
