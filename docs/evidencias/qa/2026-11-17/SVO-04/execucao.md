# Evidências — SVO legado, capacidade e despacho (task 4)

## Ambiente

- Data: 17/11/2026 (America/Cayenne; UTC−04:00)
- Branch/commit de base: `doc_Qa` / `8886e2f`; novos artefatos desta task ainda não commitados
- Serviços: Docker local; frontend Vite de QA em `127.0.0.1:4173`, API em `127.0.0.1:3000`
- Banco: desenvolvimento local; contas, chamadas, ordens e relatos usados foram sintéticos
- Perfil: SVO
- Automação: `FrontEnd/tests/e2e/docker/svo-regressao.spec.ts`
- Resultado final: 3/3 testes E2E aprovados em uma execução completa.
- Retomada após acesso ao Docker: 3/3 testes aprovados novamente.

## Cenários executados

| ID     | Passos e evidência                                                                                                                                                | Esperado                                                                                                                  | Obtido                                                                                                                      | Resultado                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| SVO-01 | Pela interface SVO, abrir “Registrar chamado”, enviar nome/endereço/relato fictícios e observar o protocolo e a entrada na fila. Enviar também payload API vazio. | Cadastro cria protocolo e aparece na fila; payload incompleto é rejeitado sem criar registro.                             | POST válido 201; chamado sintético apareceu na fila; payload vazio 400.                                                     | PASSOU                                                                             |
| SVO-02 | Para fixture sintética, tentar recusar triagem sem parecer; depois enviar recusa com justificativa.                                                               | Recusa sem justificativa retorna 400 e mantém chamado pendente; justificativa válida registra a decisão.                  | Sem justificativa 400; recusa válida 200 e status `RECUSADO`. Chamados de capacidade foram aprovados com parecer sintético. | PASSOU (conteúdo sanitário real e exportação não inspecionados)                    |
| SVO-03 | Selecionar viatura SVO vazia e motorista disponível; preencher todas menos uma vaga, aprovar dois chamados e emitir as duas ordens concorrendo pela última vaga.  | Uma operação vence; a outra recebe conflito/capacidade; ocupação nunca excede o máximo; reservas de teste são canceladas. | Uma resposta 201 e uma 409/422; ocupação igual ao limite; todas as ordens de teste canceladas ao final.                     | PASSOU                                                                             |
| SVO-04 | Emitir ordem sintética; tentar pular direto para entrega; avançar em deslocamento → local → entregue.                                                             | Etapa fora de ordem é recusada sem transição; etapas válidas avançam uma vez na ordem prevista.                           | Pulo 409; etapas válidas 200, respectivamente.                                                                              | PASSOU (operação executada por SVO; identidade MOTORISTA e ordem alheia pendentes) |
| SVO-05 | Após entrega, consultar viatura; tentar nova ordem enquanto aguarda desinfecção; confirmar e repetir confirmação.                                                 | Viatura bloqueada até confirmação; primeira liberação conclui; repetição retorna conflito.                                | Viatura `DESINFECCAO`; nova ordem 422; liberação 200 para `DISPONIVEL`; repetição 409.                                      | PASSOU                                                                             |

Os identificadores e os valores sintéticos foram mantidos nos resultados locais do Playwright, não copiados para esta evidência. Chamados recusados permanecem no histórico como dados de QA; ordens de capacidade foram canceladas e a viatura usada no fluxo foi liberada após desinfecção.

## Tentativa intermediária

A primeira execução do cenário telefônico falhou apenas porque o teste usava um seletor `role=status` ambíguo (alerta de sucesso e status de atualização de escala). Não houve falha da aplicação. Corrigi o seletor e o teste passou. A fixture incompleta criada nessa tentativa foi identificada pelo prefixo sintético exclusivo e encerrada na execução seguinte.

## Limites desta rodada

- Não testei acesso de ADMIN à triagem, exposição de conteúdo sanitário em auditoria/relatórios/exportação, chamada telefônica externa nem atendimento por usuário externo.
- Não testei indisponibilidade/CNH vencida nem motorista tentando avançar ordem alheia. Os cenários de despacho verificaram capacidade, concorrência, sequência, bloqueio e liberação sanitária com uma viatura e um motorista elegíveis do banco local.
- Remanejamento SVO permanece pendente para SVO-06; solicitação externa segue bloqueada até a integração do perfil.
- Não foi encontrado bug reproduzível nesta rodada SVO. Os achados de outras áreas foram registrados separadamente como [S19FROTA-290](https://residenciasoftware.atlassian.net/browse/S19FROTA-290) e [S19FROTA-291](https://residenciasoftware.atlassian.net/browse/S19FROTA-291).
