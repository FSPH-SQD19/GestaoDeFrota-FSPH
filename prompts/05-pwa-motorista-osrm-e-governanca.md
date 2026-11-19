# Prompts — PWA do Motorista, Roteirização OSRM/PostGIS e Governança Operacional (PRM-05)

Este documento registra os prompts das funcionalidades avançadas implementadas nas Sprints 6 a 11 do projeto **ROTA (Squad 19 — FSPH)**, incluindo o **PWA Mobile do Motorista com OSRM e PostGIS**, **Gestão de Avarias**, **Programação de Manutenção Preventiva**, **Cancelamento/Reagendamento de Viagens** e **Relatórios Operacionais CSV/PDF**.

---

## 1. Prompt do PWA do Motorista com Diário de Bordo Offline-First e Roteirização OSRM

### Versão: `v1.0` -> `v2.0` (Sprints 9 a 11)

#### Contexto Operacional:

Motoristas da frota administrativa e das viaturas SVO operam em deslocamento por todo o estado de Sergipe, frequentemente em trechos com oscilação de rede móvel. A interface precisava funcionar como um **Progressive Web App (PWA)** com fila offline em IndexedDB, captura de geolocalização e cálculo de rotas via OSRM + PostGIS.

#### Prompt Utilizado:

```markdown
Atue como Engenheiro Full-Stack Especialista em PWA, React, IndexedDB (`idb`), MapLibre/Leaflet, PostGIS e OSRM.

Implemente o módulo de Diário Operacional e Rastreamento do Motorista (`BackEnd/src/service/diario_s.ts` e `FrontEnd/src/features/motorista/`):

1. Diário de Bordo Unificado (`SaidaOperacional`):
   - Suportar saídas do tipo `ADMINISTRATIVA` (vinculadas a `SolicitacaoViagem`) e `SVO` (vinculadas a múltiplas `OrdemColetaSvo` respeitando a sequência e capacidade da viatura).
   - Exigir checklist de saída e leitura de `kmInicial` ao iniciar, e checklist de retorno com `kmFinal >= kmInicial` ao encerrar.
2. Resiliência Offline-First no Front-End (`offline.ts`):
   - Armazenar comandos operacionais e amostras de GPS em IndexedDB local quando o dispositivo estiver sem conexão, sincronizando em ordem cronológica assim que a conectividade retornar.
3. Roteirização OSRM e Telemetria PostGIS:
   - Consultar o serviço OSRM no BackEnd (`calcularRota`) sem expor credenciais ou endpoints internos ao navegador, retornando distância, duração e geometria GeoJSON.
   - Persistir posições em `PosicaoSaida` e `UltimaPosicaoSaida` usando tipo espacial `geography(Point, 4326)` com índice `Gist`.
```

---

## 2. Prompt de Acompanhamento de Avarias, Revisão por Km e Manutenção Preventiva

### Versão: `v2.0` (Sprints 10 e 11)

#### Prompt Utilizado:

```markdown
Implemente o fluxo integrado de conservação da frota (`avaria_s.ts`, `programacao_manutencao_s.ts` e alertas de revisão em `veiculo_s.ts`):

1. Avarias do Checklist (`AvariaViagem` e `AvariaHistorico`):
   - Quando o motorista apontar item com problema no checklist de retorno da viagem, abrir automaticamente registro de avaria com situação `PENDENTE`.
   - Permitir ao Gestor/Admin analisar a avaria com justificativa obrigatória, podendo encaminhar diretamente para abertura de `Manutencao` ou concluir análise, gravando histórico imutável.
2. Programação de Manutenção Preventiva com Reserva de Horário:
   - Verificar conflitos de agenda (`inicioPrevisto` a `fimPrevisto`) contra viagens aprovadas/em trânsito e outras reservas ativas do mesmo veículo antes de confirmar.
3. Alertas de Revisão por Quilometragem:
   - Monitorar `odometroAtual` em relação a `kmProximaRevisao`, gerando indicadores visuais e notificações preventivas quando o veículo se aproxima ou ultrapassa o limite configurado.
```

---

## 3. Prompt de Relatórios Operacionais e Exportação Oficial CSV / PDF

### Versão: `v2.0` (Sprint 9 — `S19FROTA-132`)

#### Prompt Utilizado:

```markdown
Implemente os endpoints de relatórios operacionais e agregações (`relatorio_s.ts`, `relatorio_agregacao_s.ts`) e a exportação em CSV e PDF (`pdf-lib` + `RelatoriosPage.tsx`):

1. Agregações Reais por Período (`inicio` e `fim` no fuso `-03:00`):
   - Consumo de combustível e custo por veículo/frota.
   - Histórico e custos de manutenções preventivas e corretivas.
   - Volume de viagens por setor solicitante e desempenho de atendimento.
2. Exportação e Impressão:
   - Gerar arquivo CSV com encoding UTF-8 e separadores padronizados.
   - Gerar documento PDF institucional formatado com cabeçalho da FSPH, período consultado e tabelas consolidadas, sem fabricar valores fictícios quando não houver registros no período.
```
