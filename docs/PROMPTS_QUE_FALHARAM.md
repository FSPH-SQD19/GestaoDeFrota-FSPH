# Exemplos de Prompts que Falharam, Ajustes e Validação (Critério 1.5)

> **Entrega Final — Takeoff (Squad 19 · FSPH / ROTA)**  
> _Documento executivo (máx. 1 página) relatando exemplos reais de prompts que falharam durante o projeto, como foram corrigidos pela equipe e como o output da IA foi validado._

---

## Caso 1: Alucinação em Regra Sanitária Crítica do SVO (Capacidade de Urnas e Desinfecção)

- **Prompt Inicial que Falhou:**
  > _"Crie a função de despacho de viatura para remoção de corpos no SVO em `svo_s.ts`. Aloque qualquer viatura disponível ou em trânsito próximo e agrupe as coletas ativas para economizar combustível."_
- **Falha Observada no Output da IA:**
  O modelo priorizou a "economia de combustível" e gerou uma lógica que: **(1)** permitia despachar viaturas com status `DESINFECCAO`; **(2)** agrupava até 6 coletas simultâneas na mesma viatura (violando o limite físico do baú isotérmico da viatura SVO, que comporta no máximo **4 urnas**); e **(3)** não bloqueava chamados ainda `EM_ANALISE` ou `RECUSADO` (casos de competência do IML).
- **Como Foi Ajustado (Prompt Engineering & Guardrails):**
  Aplicamos **Restrições Negativas Explícitas (_Negative Constraints_)** e especificação de máquina de estados no prompt (`PRM-02 v3.5`): exigimos verificação determinística `veiculo.tipoFrota === "SVO"`, bloqueio de status `DESINFECCAO | MANUTENCAO | INATIVO`, contagem transacional de ordens ativas `< veiculo.capacidadeMaxima` (4) e transição automática para `DESINFECCAO` ao concluir a última entrega no SVO.
- **Como a Equipe Validou o Output:**
  Criamos testes unitários e de fluxo HTTP (`BackEnd/tests/unit/service/svo_s.test.ts` e `svo_fluxo_r.test.ts`) além do cenário E2E `SVO-04` ([`docs/evidencias/qa/2026-11-17/SVO-04/execucao.md`](evidencias/qa/2026-11-17/SVO-04/execucao.md)), comprovando o bloqueio `400/409` ao tentar alocar viatura em desinfecção ou acima da capacidade e a liberação somente após confirmar a higienização.

---

## Caso 2: Condição de Corrida (Dupla Alocação Simultânea) em Viagens e Reservas

- **Prompt Inicial que Falhou:**
  > _"Implemente a aprovação de solicitação de viagem e o cancelamento em `aprovacao_s.ts` e `solicitacao_s.ts`. Verifique com `findFirst` se o veículo e o motorista estão livres no horário e depois faça `update`."_
- **Falha Observada no Output da IA:**
  A IA gerou um padrão clássico _Check-Then-Act_ fora de isolamento transacional: quando duas requisições concorrentes chegavam no mesmo milissegundo (ex.: dois gestores aprovando viagens para o mesmo veículo ou motorista, ou cancelamento concorrente ao início da viagem), ambas passavam pelo `findFirst` antes do `update`, resultando em **dupla alocação do mesmo recurso**.
- **Como Foi Ajustado (Prompt Engineering & Guardrails):**
  Evoluímos o prompt `PRM-01` para a versão `v3.0`, exigindo: _"Envolva toda decisão de alocação, reagendamento, reserva preventiva ou cancelamento em `prisma.$transaction`, utilizando lock pessimista (`SELECT ... FOR UPDATE`) ou atualização condicional atômica (`updateMany` validando `status` atual e `versao`) e lançando `HttpError(409)` se `count !== 1`"_.
- **Como a Equipe Validou o Output:**
  Validamos com testes unitários de concorrência (`aprovacao_r.test.ts`, `solicitacao_s.test.ts`, `programacao_manutencao_s.test.ts`) e com o teste E2E de estresse em contêiner (`FrontEnd/tests/e2e/docker/dupla-alocacao.spec.ts`), que dispara requisições paralelas via `Promise.all` e comprova que apenas uma vence (`200`) enquanto a concorrente recebe `409 Conflict`.

---

## Caso 3: Loop de Renderização no React e Reprovação no Linter Estrito (`oxlint`)

- **Prompt Inicial que Falhou:**
  > _"Atualize o componente `NotificacoesDropdown.tsx` e os modais de cadastro para buscar os dados da API e limpar o estado de erro sempre que as props mudarem."_
- **Falha Observada no Output da IA:**
  O modelo invocou `setState` de forma síncrona na raiz de um `useEffect` sem guarda de requisição em voo (_in-flight request_), disparando erro bloqueante no pipeline (`oxlint --deny-warnings`) e criando condição de corrida na UI quando o usuário trocava filtros rapidamente.
- **Como Foi Ajustado (Prompt Engineering & Guardrails):**
  Incluímos no prompt `PRM-03 v3.0` a restrição: _"O código deve passar com 0 warnings em `oxlint --deny-warnings`. Nunca invoque `setState` síncrono no topo de `useEffect`; derive estados de carregamento por chave de revisão/sessão ou controle respostas obsoletas com flag `mounted` / ref de requisição"_.
- **Como a Equipe Validou o Output:**
  Validação automática no GitHub Actions (`npm run lint` com `0 warnings and 0 errors` em 280+ arquivos BackEnd e FrontEnd) e suíte de testes de interface (`NotificacoesDropdown.test.tsx`, `DashboardPage.test.tsx`).
