# SLA do SVO e ordens do motorista

`GET /api/v1/svo/indicadores` (ADMIN/SVO) preserva os indicadores existentes e acrescenta:

- `tempoMedioChamadoChegadaLocalMinutos`: média entre abertura e chegada ao local.

- `tempoMedioChamadoEntregaSvoMinutos`: média entre abertura e entrega no SVO.

- `amostrasChegadaLocal` e `amostrasEntregaSvo`: denominadores independentes.

As médias são números em minutos, sem arredondamento, ou `null` quando não há amostras. Ordens canceladas, datas desconhecidas e intervalos negativos são excluídos. Entregas anteriores à chegada também são excluídas da média de entrega. Ordens ainda em andamento podem compor a média de chegada quando essa etapa já ocorreu. Não há limite de SLA presumido.

A abertura é persistida em `ChamadoSvo.criadoEm`. A migração recupera registros antigos pela primeira auditoria CRIAR do chamado; sem auditoria, a data permanece nula e não compõe as médias. Aplicar a migração antes de iniciar a versão nova (`npm run prisma:migrate:deploy --workspace=backend`).

`GET /api/v1/svo/ordens-coleta/minhas` exige MOTORISTA e retorna `{ data, meta: { page, pageSize, total, totalPages } }`. Cada ordem inclui o chamado, os horários das etapas e a viatura (id, placa e modelo). O vínculo é resolvido por `Motorista.usuarioId` da sessão, com motorista ativo. Sem vínculo ou ordens, retorna lista vazia. Não aceita identificador de outro motorista.

Parâmetros opcionais: `page` (padrão 1), `pageSize` (padrão 10, máximo 100), `status` (AGUARDANDO_DESPACHO, EM_ANDAMENTO, EM_DESLOCAMENTO, NO_LOCAL, ENTREGUE_SVO, CONCLUIDA ou CANCELADA). Sem status, lista o histórico completo. Ordenação por abertura decrescente e id para desempate. Exemplo: `/api/v1/svo/ordens-coleta/minhas?status=NO_LOCAL&page=1&pageSize=10`.

Esta subtask implementa indicadores e listagem. A autorização MOTORISTA para avanço de etapas e a interface mobile não são alteradas.

O Dashboard reutiliza o mesmo cálculo em `svo.slaMedioRespostaMinutos`, medindo abertura do chamado até chegada ao local. O seed demo registra abertura anterior aos horários das coletas.
