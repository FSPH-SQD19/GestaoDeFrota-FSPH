# Matriz de QA exploratória e regressão E2E

[Índice da documentação](README.md)

## Objetivo e estado

Matriz de preparação para a auditoria exploratória e regressão da plataforma ROTA. Organiza os cenários por módulo, perfil e risco e define o resultado esperado e a evidência necessária para cada execução.

**Estado desta entrega:** matriz criada em 17/11/2026. Os cenários abaixo ainda não foram executados como exploração contra uma aplicação/API integrada. Referências a testes automatizados indicam cobertura no repositório; elas não comprovam resultado desta execução nem substituem teste E2E integrado. Nenhum bug foi declarado.

## Risco e registro de execução

| Risco | Critério |
| --- | --- |
| Crítico | Exposição de dados sanitários/pessoais, acesso indevido, dupla alocação operacional ou quebra que paralisa operação essencial. |
| Alto | Regra de negócio essencial incorreta, perda de rastreabilidade, indisponibilidade de fluxo crítico ou dados operacionais inconsistentes. |
| Médio | Fluxo recuperável com impacto limitado, divergência de relatório/notificação ou erro de validação sem perda de dados. |
| Baixo | Problema visual ou de conveniência sem impacto nos dados e no fluxo principal. |

Para cada execução, preencher o resultado na coluna **Execução** e registrar evidência sanitizada em `docs/evidencias/qa/AAAA-MM-DD/<ID>/` (ou anexar a evidência ao ticket de bug). Não incluir nomes, documentos, endereços ou dados de ocorrências reais do SVO. Usar contas e dados sintéticos autorizados.

Cada evidência deve identificar: ID do cenário, data/hora e fuso, ambiente/versão/commit, perfil e pré-condições, passos reproduzíveis, esperado, obtido, resultado (`PASSOU`, `FALHOU`, `BLOQUEADO`), captura de tela ou request/response/log sanitizado e, quando aplicável, ticket de bug e reteste. Uma falha só vira bug após repetição reproduzível; verificar Jira por resumo, módulo, passos e comportamento antes de abrir para evitar duplicatas.

## Matriz de cenários

`Automação existente` aponta um teste no repositório, quando encontrado. A maioria dos E2E atuais intercepta/mocka a API; confirmar em execução se o cenário usa serviços reais antes de classificá-lo como integração. `—` significa que não foi localizada referência direta durante a preparação da matriz.

| ID | Módulo | Perfil | Risco | Cenário / pré-condição | Resultado esperado | Automação existente | Execução / evidência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUT-01 | Autenticação | Todos | Alto | Acessar rota protegida sem sessão e com sessão expirada. | API responde 401; interface solicita autenticação e não exibe dados protegidos. | `FrontEnd/tests/e2e/auth.spec.ts` | Pendente |
| AUT-02 | Autenticação | Todos | Alto | Enviar credencial inválida e repetir até limite configurado. | Credencial é rejeitada sem criar sessão; limite responde 429 e informa espera sem revelar se a conta existe. | `FrontEnd/tests/e2e/auth.spec.ts`; `BackEnd/tests/unit/routes/auth_r.test.ts` | Pendente |
| AUT-03 | Autenticação / sessão | Todos | Alto | Encerrar sessão e reutilizar cookie/token anterior; testar CSRF em mutação autenticada. | Sessão revogada não autoriza chamadas; mutações sem proteção CSRF válida são rejeitadas. | `FrontEnd/tests/e2e/auth.spec.ts` cobre logout de navegador | Pendente |
| RBAC-01 | Usuários / auditoria | ADMIN | Alto | Criar/editar/inativar usuário e consultar auditoria com conta ADMIN. | Operações permitidas; senha/hash não aparece em resposta/log; auditoria registra autoria e alteração. | Testes de `usuario_r`, `usuario_s`, `auditoria_r` | Pendente |
| RBAC-02 | Permissões / dados | SOLICITANTE | Crítico | Chamar diretamente endpoints de frota, SVO, relatórios e dados de outro solicitante; adulterar IDs na URL/body. | 403/404 conforme política; nenhum dado alheio é retornado nem alterado. | Testes unitários de rotas; sem matriz E2E por perfil localizada | Pendente |
| RBAC-03 | Permissões / dados | MOTORISTA | Crítico | Consultar viagem/ordem de outro motorista e tentar avançar ou concluir recurso não atribuído. | Acesso restrito às próprias atribuições; alteração indevida negada e auditável. | `BackEnd/tests/unit/routes/svo_r.test.ts`; `solicitacao_r.test.ts`; E2E parcial | Pendente |
| RBAC-04 | Permissões / dados sanitários | GESTOR | Crítico | Consultar endpoints e campos restritos do SVO e localização sem perfil autorizado. | Acesso negado ou somente campos autorizados; não há vazamento via relatório, busca ou exportação. | `BackEnd/src/routes/svo_r.ts`; testes unitários de rota | Pendente |
| RBAC-05 | Permissões | SVO | Alto | Tentar administrar usuários, manutenção administrativa, relatórios e frota administrativa. | Apenas capacidades explicitamente autorizadas ficam disponíveis; demais chamadas são negadas também na API. | Testes unitários de rotas SVO/relatórios/manutenção | Pendente |
| FRO-01 | Veículos | ADMIN, GESTOR | Alto | Cadastrar e editar veículo; submeter placa duplicada/malformada, capacidade fora de 1–50 e propriedade locada sem fornecedor. | Entrada válida persiste normalizada; inválida recebe erro de validação claro e não grava registro parcial. | `BackEnd/tests/unit/service/veiculo_s.test.ts`; E2E de alertas no `dashboard-svo.spec.ts` | Pendente |
| FRO-02 | Veículos / segregação | ADMIN, GESTOR, SVO | Crítico | Tentar reservar veículo administrativo para SVO e veículo SVO para viagem administrativa. | Segregação de frota é aplicada no servidor e recursos permanecem livres após rejeição. | `BackEnd/tests/unit/service/svo_s.test.ts`; `aprovacao_r.test.ts` | Pendente |
| FRO-03 | Alocação concorrente | GESTOR, SVO | Crítico | Submeter em paralelo duas solicitações/ordens para o mesmo veículo ou motorista no mesmo intervalo; repetir disputa pelo último espaço SVO. | No máximo uma operação incompatível é aceita; resposta perdedora informa conflito; estado e capacidade permanecem consistentes. | Testes de reservas preventivas e capacidade unitários; concorrência E2E não localizada | Pendente |
| VIA-01 | Solicitações / viagens | SOLICITANTE | Alto | Solicitar viagem válida; consultar próprias solicitações; enviar campos ausentes, quantidade inválida, data passada ou período invertido. | Solicitação válida recebe protocolo e pertence ao solicitante; dados inválidos são rejeitados sem persistência. | `BackEnd/tests/unit/routes/solicitacao_r.test.ts`; `solicitacao_s.test.ts` | Pendente |
| VIA-02 | Aprovação / despacho | GESTOR, ADMIN | Crítico | Aprovar, recusar e alocar com veículo/motorista livre; repetir aprovação ou alocação com recurso ocupado/inativo, CNH/documento vencido ou manutenção impeditiva. | Transição válida é auditada; conflito ou indisponibilidade impede despacho sem reserva parcial/dupla alocação. | `BackEnd/tests/unit/routes/aprovacao_r.test.ts`; `FrontEnd/tests/e2e/dashboard-svo.spec.ts` para reagendamento | Pendente |
| VIA-03 | Execução / quilometragem | MOTORISTA | Alto | Iniciar e concluir viagem atribuída; tentar iniciar viagem alheia e concluir com hodômetro menor que o inicial ou valor inválido. | Somente motorista atribuído pode operar; hodômetro consistente é salvo e recursos liberados uma única vez. | `FrontEnd/tests/e2e/viagens.spec.ts`; `BackEnd/tests/unit/service/execucao_s.test.ts` | Pendente |
| VIA-04 | Cancelamento / reagendamento | SOLICITANTE, GESTOR | Alto | Cancelar segundo status/política; reagendar alterando período e recursos; repetir requisição concorrente. | Transições permitidas respeitam status e motivo; reservas antigas e novas ficam consistentes e auditadas. | `BackEnd/tests/unit/routes/solicitacao_r.test.ts`; E2E de reagendamento | Pendente |
| MAN-01 | Manutenção | ADMIN, GESTOR | Alto | Agendar, reagendar, cancelar e concluir manutenção; testar intervalo conflitante, veículo alocado e payload incompleto. | Conflitos e entrada inválida são recusados; indisponibilidade do veículo e histórico refletem o ciclo sem duplicação. | `BackEnd/tests/unit/routes/manutencao_r.test.ts`; `programacao_manutencao_r.test.ts` | Pendente |
| DOC-01 | Documentos / disponibilidade | ADMIN, GESTOR | Alto | Cadastrar/renovar documento; testar tipo inválido, data vencida e tentativas de alocação com documento vencido ou próximo do vencimento. | Datas/situação e alertas seguem regra publicada; requisito impeditivo bloqueia alocação sem ignorar o alerta. | `BackEnd/tests/unit/service/documento_veiculo_s.test.ts`; E2E de alertas parcial | Pendente |
| NOT-01 | Notificações | Todos | Médio | Consultar, marcar uma e marcar todas como lidas; trocar ID por notificação de outro usuário. | Contagem acompanha alterações; acesso cruzado é negado; erro de API não marca notificação como lida localmente. | `BackEnd/tests/unit/routes/notificacao_r.test.ts`; teste de dropdown frontend | Pendente |
| REL-01 | Relatórios / exportação | ADMIN, GESTOR | Alto | Consultar viagens, consumo e manutenção por período, incluindo período inválido, sem dados e dados de teste SVO. | Totais correspondem aos registros e filtros; período inválido é rejeitado; perfis não autorizados não acessam/exportam dados. | `BackEnd/tests/unit/routes/relatorio_r.test.ts`; testes de agregação | Pendente |
| API-01 | Resiliência / contratos | Todos | Alto | Indisponibilidade, timeout, 4xx/5xx, resposta truncada e repetição de POST; avaliar fluxos de leitura e gravação. | Interface mostra erro recuperável sem tela quebrada; gravação não duplica por retry; log não expõe token ou dado sensível. | `FrontEnd/tests/e2e/auth.spec.ts` cobre falha de login; outros módulos pendentes | Pendente |
| SVO-01 | Chamado telefônico legado | SVO, ADMIN | Alto | Registrar chamado sintético recebido por telefone e consultar fila/protocolo; tentar salvar campos obrigatórios ausentes. | Registro manual mantém origem e protocolo/rastreabilidade; validação impede chamado incompleto e preserva dados mínimos necessários. | `FrontEnd/tests/e2e/dashboard-svo.spec.ts` usa API mockada | Pendente |
| SVO-02 | Triagem sanitária | SVO, ADMIN | Crítico | Iniciar, aprovar e reprovar triagem; testar justificativa ausente e usuário sem permissão; inspecionar telas/logs/exportação. | Transições e parecer ficam auditados; justificativa obrigatória conforme regra; dado sanitário só é exposto a perfis autorizados. | `BackEnd/tests/unit/service/svo_s.test.ts`; E2E mockado | Pendente |
| SVO-03 | Capacidade / despacho | SVO, ADMIN | Crítico | Emitir ordens até a capacidade máxima; exceder capacidade e concorrer por última vaga; despachar motorista/viatura indisponível. | Capacidade não é ultrapassada nem sob concorrência; despacho exige recursos elegíveis e não deixa reserva parcial. | `BackEnd/tests/unit/service/svo_s.test.ts`; `svo_fluxo_r.test.ts`; E2E mockado | Pendente |
| SVO-04 | Coleta / sanitização | MOTORISTA, SVO | Crítico | Avançar saída → local → entrega; tentar pular/retroceder etapa e consultar ordem alheia; concluir última coleta. | Apenas próxima etapa permitida é registrada com horário/autoria; veículo entra em desinfecção ao fim da operação. | `FrontEnd/tests/e2e/dashboard-svo.spec.ts`; `BackEnd/tests/unit/routes/svo_fluxo_r.test.ts` | Pendente |
| SVO-05 | Desinfecção / liberação | SVO, ADMIN | Crítico | Tentar reusar viatura antes de confirmar desinfecção; confirmar mais de uma vez ou após estado incompatível. | Viatura permanece indisponível até procedimento válido; liberação ocorre uma vez e gera trilha de auditoria/notificação. | E2E SVO mockado; `BackEnd/tests/unit/service/svo_s.test.ts` | Pendente |
| SVO-06 | Solicitação externa | Usuário externo, SVO | Alto | Após integração, enviar solicitação externa válida/inválida, repetir envio, consultar protocolo e acompanhar tratamento até ordem. | Contrato de autenticação/identificação, validação, deduplicação, privacidade e transição para fila interna são definidos e funcionam ponta a ponta. | Integração externa ainda não identificada nesta preparação | Bloqueado até integração; registrar ambiente/contrato quando disponível |

## Ordem recomendada de execução

1. Preparar ambiente de QA com banco isolado, build/commit identificados e perfis/cadastros sintéticos para os cinco papéis.
2. Executar primeiro AUT/RBAC, FRO-02/FRO-03 e SVO-02–SVO-05 por criticidade; interromper a exploração de dados reais se houver exposição sanitária.
3. Executar os fluxos funcionais VIA, MAN, DOC, NOT e REL por perfil, incluindo entradas inválidas e recuperação após indisponibilidade.
4. Repetir cenários concorrentes, coletar evidência sanitizada e conferir o Jira antes de abrir cada bug.
5. Após integração externa, retirar o estado bloqueado de SVO-06 e executar o contrato ponta a ponta.

## Referências do repositório

- Regras e escopo: [PROJETO.md](PROJETO.md), [FRONTEND.md](FRONTEND.md), [BACKEND.md](BACKEND.md) e [svo-sla.md](svo-sla.md).
- Execução dos testes: [TESTES.md](TESTES.md).
- E2E Playwright: `FrontEnd/tests/e2e/`.
- Rotas/API: `BackEnd/src/routes/` e `BackEnd/src/middleware/RBAC_m.ts`.
- Itens informados como contexto (acesso Jira indisponível nesta execução): [S19FROTA-224](https://residenciasoftware.atlassian.net/browse/S19FROTA-224) e [S19FROTA-202](https://residenciasoftware.atlassian.net/browse/S19FROTA-202).
