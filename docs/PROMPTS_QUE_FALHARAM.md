# Exemplos de Prompts que Falharam e Lições Aprendidas

> **Critério 1.5 — Entrega Final Takeoff (Squad 19 · FSPH / ROTA)**  
> _Relatório enxuto (1 página) documentando falhas reais de IA no desenvolvimento, análise de causa raiz, correções e validação._

---

### Caso 1: Alucinação em Regra Sanitária Crítica do SVO (Capacidade e Desinfecção da Viatura)

- **Prompt que Falhou**:
  ```text
  "Crie a função de despacho de viatura para remoção de corpos no SVO. Aloque qualquer viatura disponível ou em trânsito próximo e agrupe as coletas para economizar combustível."
  ```
- **Comportamento Indesejado (Falha)**:
  O modelo gerou código que permitia alocar viaturas que estavam em status `DESINFECCAO`, acumulou 6 corpos em uma única viatura (quando o limite físico do compartimento isotérmico da Chevrolet S10 da FSPH é de **4 urnas**) e sugeriu agrupar um chamado com óbito violento suspeito (competência exclusiva do IML).
- **Causa Raiz**:
  Prompt excessivamente genérico e sem injeção dos protocolos sanitários da ANVISA e da portaria do SVO Estadual. O modelo otimizou para "eficiência de rota" ignorando restrições de biossegurança e capacidade física.
- **Prompt Corrigido & Guardrails Adotados**:
  Injeção de **Negative Constraints**, enumeração explícita de status proibidos (`DESINFECCAO`, `MANUTENCAO`), validação determinística de soma de urnas (`<= 4`) e bloqueio de triagem para IML via schema Zod no controller. A decisão crítica foi blindada no código da aplicação (`svo_s.ts`).
- **Validação**:
  Criação de teste unitário no Vitest (`svo_s.test.ts`) forçando tentativa de despacho com viatura em desinfecção ou capacidade excedida, verificando o lançamento obrigatório de `AppError(400, "Viatura indisponível para despacho")`.

---

### Caso 2: Violação de Linter Estrito e Loop de Renderização em Componente React

- **Prompt que Falhou**:
  ```text
  "Atualize o componente NotificacoesDropdown.tsx para buscar as notificações não lidas da API e atualizar o contador no badge sempre que o usuário abrir o menu."
  ```
- **Comportamento Indesejado (Falha)**:
  O código gerado executava `setNotificacoes(...)` e `setCarregando(...)` síncronos na raiz de um `useEffect` sem dependências estáveis, causando avisos bloqueantes no CI (`oxlint --deny-warnings`: `react(set-state-in-effect)`) e provocando chamadas HTTP redundantes a cada 30 segundos, ignorando notificações não lidas além dos primeiros 25 registros.
- **Causa Raiz**:
  Falta de instrução sobre a política de **zero warnings** da squad e ausência de especificações sobre concorrência assíncrona (in-flight request abort / guards de montagem).
- **Prompt Corrigido & Guardrails Adotados**:
  Prompt com regra explícita de linting: _"Não execute setState síncrono no topo de useEffect; use refs (`requisicaoIdRef`) para descarte de respostas obsoletas e trate o estado de erro com role='alert' sem exibir estado vazio falso"_. No backend, foi adicionado cache per-user de 5 minutos (`notificacao_sync_cache.ts`) para evitar sobrecarga de consultas a cada 30 segundos.
- **Validação**:
  Suíte com 4 testes no FrontEnd (`NotificacoesDropdown.test.tsx`) e pipeline de CI executando `oxlint --deny-warnings` com **0 erros e 0 warnings**.

---

### Conclusão e Lição da Equipe para a Banca

A IA é uma aliada formidável na **aceleração e qualidade de código**, mas **nunca deve ter autoridade isolada sobre regras de saúde pública, biossegurança ou conformidade com linters**. No projeto ROTA, todo output de IA passou por sanitização humana, tipagem estrita TypeScript, validação Zod e testes automatizados.
