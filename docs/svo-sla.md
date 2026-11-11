# SLA do SVO e ordens do motorista

`GET /api/v1/svo/indicadores` (ADMIN/SVO) preserva os indicadores existentes e acrescenta:

- `tempoMedioChamadoChegadaLocalMinutos`: média entre abertura e chegada ao local.

- `tempoMedioChamadoEntregaSvoMinutos`: média entre abertura e entrega no SVO.

- `amostrasChegadaLocal` e `amostrasEntregaSvo`: denominadores independentes.

As médias são números em minutos, sem arredondamento, ou `null` quando não há amostras. Ordens canceladas, datas desconhecidas e intervalos negativos são excluídos. Entregas anteriores à chegada também são excluídas da média de entrega. Ordens ainda em andamento podem compor a média de chegada quando essa etapa já ocorreu. Não há limite de SLA presumido.

A abertura é persistida em `ChamadoSvo.criadoEm`. A migração recupera registros antigos pela primeira auditoria CRIAR do chamado; sem auditoria, a data permanece nula e não compõe as médias. Aplicar a migração antes de iniciar a versão nova (`npm run prisma:migrate:deploy --workspace=backend`).

`GET /api/v1/svo/ordens-coleta/minhas` exige MOTORISTA e retorna `{ data, meta: { page, pageSize, total, totalPages } }`. Cada ordem inclui o chamado, os horários das etapas e a viatura (id, placa e modelo). O vínculo é resolvido por `Motorista.usuarioId` da sessão, com motorista ativo. Sem vínculo ou ordens, retorna lista vazia. Não aceita identificador de outro motorista.

Parâmetros opcionais: `page` (padrão 1), `pageSize` (padrão 10, máximo 100), `status` (AGUARDANDO_DESPACHO, EM_ANDAMENTO, EM_DESLOCAMENTO, NO_LOCAL, ENTREGUE_SVO, CONCLUIDA ou CANCELADA). Sem status, lista o histórico completo. Ordenação por abertura decrescente e id para desempate. Exemplo: `/api/v1/svo/ordens-coleta/minhas?status=NO_LOCAL&page=1&pageSize=10`.

`ativas=true` restringe a listagem às ordens AGUARDANDO_DESPACHO, EM_ANDAMENTO, EM_DESLOCAMENTO e NO_LOCAL antes da paginação. O celular usa esse filtro e percorre todas as páginas. A viatura inclui também status e capacidadeMaxima. Chamados legados com criadoEm nulo continuam visíveis, com SLA desconhecido.

MOTORISTA pode avançar somente suas próprias ordens em `PATCH /api/v1/svo/ordens-coleta/:id/etapa`: EM_DESLOCAMENTO → NO_LOCAL → ENTREGUE_SVO. O servidor registra os horários e exige a sequência; ADMIN/SVO também podem operar pela central. A interface bloqueia novo avanço enquanto atualiza a etapa confirmada.

A central SVO, o Dashboard, os cards gerais de SLA dos Relatórios e o celular consultam atualizações a cada 15 segundos com a página visível e ao retornar à página. O relógio de chamados abertos atualiza a cada segundo. Não há conexão push; a propagação entre dispositivos depende da próxima consulta e da conexão de rede.

O Dashboard reutiliza o mesmo cálculo em `svo.slaMedioRespostaMinutos`, medindo abertura do chamado até chegada ao local. O seed demo registra abertura anterior aos horários das coletas.
