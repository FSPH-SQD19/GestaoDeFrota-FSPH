# Relatório final de QA — regressão exploratória

## Resumo executivo

- Execução e retomada: 17/11/2026, Docker local e PostgreSQL de desenvolvimento, branch `doc_Qa`; evidências originais a partir do commit `8886e2f` e retestes exploratórios contra os serviços Docker iniciados nesta sessão.
- A matriz contém 34 cenários por módulo, perfil e risco: **4 passaram**, **12 foram parciais**, **2 falharam**, **15 seguem pendentes** e **1 está bloqueado pela integração do usuário externo**. Cobertura executada em algum nível: 18/34 (53%). Parcial não significa aprovação integral do cenário.
- Foram reproduzidos dois defeitos de severidade **Alta** que bloqueiam fluxos do build Docker ou manutenção preventiva. A concorrência de alocação administrativa e a capacidade concorrente SVO passaram; seguem sem cobertura suficiente a exposição sanitária indireta, motorista tentando operar ordem alheia e resiliência geral.
- Na retomada, regressão SVO: 3/3 passou; segurança/RBAC: 3/3 passou; dupla alocação administrativa: 1/1 passou; regressão geral: 1 passou e 1 falhou no defeito conhecido MAN-01. A consulta direta ao frontend Docker repetiu `200 text/html` em GET de auth e `405` no POST de login.
- Nenhuma correção foi aplicada aos dois defeitos. Portanto, não houve reteste pós-correção.

## Defeitos reproduzidos e ainda abertos

| ID local | Severidade | Módulo | Passos mínimos | Esperado | Obtido | Evidência / Jira |
| --- | --- | --- | --- | --- | --- | --- |
| QA-2026-11-17-01 | Alta | Frontend Docker / autenticação | Abrir `http://127.0.0.1:5173` e observar as chamadas do login. | `/api/v1/auth/*` é encaminhado à API e o formulário autentica. | GET de sessão/CSRF retorna `200 text/html` do fallback SPA; POST login retorna `405 text/html`; usuário permanece na tela de login. | [E2E-02](evidencias/qa/2026-11-17/E2E-02/execucao.md); Bug [S19FROTA-290](https://residenciasoftware.atlassian.net/browse/S19FROTA-290), reteste pendente de correção. |
| QA-2026-11-17-02 | Alta | Manutenção preventiva | Entrar como GESTOR; Veículos → programar manutenção de DMO2A02; selecionar janela futura sem conflito; confirmar. | POST `/api/v1/manutencoes/programacoes` retorna 201 e persiste a programação. | Resposta 500; SQLSTATE `23514`, constraint `manutencoes_status_check` rejeita `PROGRAMADA`, embora a rotina preventiva grave esse estado. Reproduzido duas vezes. | [E2E-02](evidencias/qa/2026-11-17/E2E-02/execucao.md); Bug [S19FROTA-291](https://residenciasoftware.atlassian.net/browse/S19FROTA-291), reteste pendente de correção. |

Em 17/11/2026, as assinaturas das duas falhas foram pesquisadas no projeto Jira com JQL e não foram encontrados Bugs preexistentes correspondentes. Foram abertos [S19FROTA-290](https://residenciasoftware.atlassian.net/browse/S19FROTA-290) e [S19FROTA-291](https://residenciasoftware.atlassian.net/browse/S19FROTA-291), vinculados às tarefas funcionais [S19FROTA-201](https://residenciasoftware.atlassian.net/browse/S19FROTA-201) e [S19FROTA-268](https://residenciasoftware.atlassian.net/browse/S19FROTA-268), além da subtarefa de QA [S19FROTA-278](https://residenciasoftware.atlassian.net/browse/S19FROTA-278). Nenhuma correção foi aplicada; os retestes permanecem pendentes.

## Cobertura executada

| Área | Resultado desta rodada | Risco residual |
| --- | --- | --- |
| Autenticação / RBAC | Sem sessão e bearer inválido retornaram 401; perfis foram testados contra endpoints de leitura; mutação autenticada sem CSRF e origem externa retornaram 403. | Login no frontend Docker falha. Credencial inválida/429, logout/replay e sessão expirada pendentes. |
| Isolamento de dados | SOLICITANTE só recebeu solicitações próprias; não viu nem cancelou solicitação sintética de outro usuário; tentativa de IDOR retornou 403 e fixture foi limpa. | IDOR entre motoristas, consulta de ordem alheia e auditoria ainda pendentes. |
| Frota / viagens | Listagem integrada 200; SOLICITANTE criou/cancelou solicitação (201/200); disputa paralela por veículo e motorista teve 1 aprovação 200 e 1 conflito 409; fixtures limpas. | Validações negativas, documentos, ciclos completos de aprovação/reagendamento e operação de motorista pendentes. |
| Manutenção | Fluxo de programação preventiva reproduziu 500 duas vezes antes e novamente na regressão retomada. | Correção e ciclo reagendar/cancelar/concluir aguardam reteste. Bug [S19FROTA-291](https://residenciasoftware.atlassian.net/browse/S19FROTA-291). |
| Notificações / relatórios | Leitura de notificações e três agregados de relatório respondeu 200. | Marcação, IDOR, filtros negativos e exportação pendentes. |
| SVO | Cadastro telefônico sintético e validação incompleta; capacidade concorrente com apenas uma reserva vencedora; sequência de etapas, bloqueio sanitário, liberação e rejeição de liberação duplicada. | Perfis ADMIN/MOTORISTA, exposição sanitária, auditoria/exportação, CNH vencida e remanejamento pendentes. |
| Solicitação externa | Não executada. | Bloqueada até integração do perfil/contrato externo. |

### Riscos críticos ainda sem cobertura suficiente

- Exposição de dados sanitários em busca, auditoria, exportações e relatórios; o acesso de GESTOR ao endpoint `/svo/chamados` foi negado, mas não percorri os canais indiretos.
- Autorização do MOTORISTA sobre ordem atribuída a outro condutor e inspeção de dados sanitários por canais indiretos.
- Resiliência geral a indisponibilidade/timeout e idempotência após repetição de POST.
- Autorização do MOTORISTA sobre ordem atribuída a outro condutor.

## Revalidação de correções

Não havia correções aplicadas aos defeitos QA-01/02 nesta branch durante a retomada. A falha de manutenção e o roteamento/login Docker foram reproduzidos novamente; isso confirma que continuam abertos, mas não é reteste pós-correção.

## Recomendação para homologação

Não homologar o pacote Docker enquanto o login do frontend publicado falhar. Corrigir e retestar também a constraint de manutenção preventiva antes de liberar esse módulo. Os Bugs [S19FROTA-290](https://residenciasoftware.atlassian.net/browse/S19FROTA-290) e [S19FROTA-291](https://residenciasoftware.atlassian.net/browse/S19FROTA-291) já foram deduplicados e abertos. Após as correções, repetir os E2E associados e atualizar este relatório com versão/commit, resultado e evidência de reteste. Priorizar também os riscos sanitários indiretos e a autorização do motorista.

## Referências

- [Matriz de testes](MATRIZ_QA_EXPLORATORIA.md)
- [Evidências E2E integradas](evidencias/qa/2026-11-17/E2E-02/execucao.md)
- [Evidências de segurança](evidencias/qa/2026-11-17/SEC-03/execucao.md)
- [Evidências SVO](evidencias/qa/2026-11-17/SVO-04/execucao.md)
- [Evidência de dupla alocação](evidencias/qa/2026-11-17/FRO-03/execucao.md)
- [S19FROTA-224](https://residenciasoftware.atlassian.net/browse/S19FROTA-224) e [S19FROTA-202](https://residenciasoftware.atlassian.net/browse/S19FROTA-202)
