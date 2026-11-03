# PWA dos motoristas

O módulo reutiliza o login do ROTA e abre em `/motorista`. Na central, a aba **Mapa e operação** reúne confirmação de pontos, locais, acompanhamento e percurso. Requer HTTPS para instalação e GPS, exceto localhost no desenvolvimento.

## Ativação

1. Aplicar as migrations pelo fluxo existente, primeiro em desenvolvimento e depois em HML. A migration `20261031120000_driver_pwa` preserva registros existentes e adiciona diário, vínculos, comandos, coordenadas e posições PostGIS.
2. Preparar o servidor OSRM conforme abaixo.
3. No Node: configurar `DRIVER_PWA_ENABLED=true`, `OSRM_URL` e `OSRM_TOKEN` em `BackEnd/.env`. Reiniciar a API.
4. No Worker: configurar `OSRM_URL` e `OSRM_TOKEN` como secrets/bindings do ambiente HML; alterar `DRIVER_PWA_ENABLED` de `false` para `true` no Wrangler e publicar pelo fluxo HML. O CD mantém a flag desativada até essa alteração explícita. A URL deve ser HTTPS e acessível pelo Worker; localhost só funciona no Node local.
5. Confirmar pontos de origem/destino, ocorrência, sequência e base na central. Coordenadas usam **longitude, latitude**. A base é compartilhada pelas ordens aguardando despacho do mesmo motorista e veículo.

O front-end consulta `/api/v1/motorista/config`; nenhuma credencial OSRM chega ao navegador. `VITE_MAP_STYLE_URL` substitui o estilo Liberty/OpenFreeMap no build. Manter atribuições do mapa.

## Interface do motorista

O motorista tem uma tela própria com mapa em tela cheia e painel inferior. A navegação usa **Viagens**, **Histórico** e **Conta**; a gestão administrativa mantém seu menu habitual. **Preparar saída** abre duas etapas: veículo/odômetro e checklist. Durante a viagem, a ação principal muda de **Registrar coleta** para **Finalizar viagem**, conforme a sequência SVO. Abastecimento, percurso, retorno e pendências abrem em painéis com foco de teclado e fechamento por Escape. Usuários com outros perfis podem voltar à gestão pela conta.

As notificações ficam disponíveis no sino do cabeçalho, incluindo viagens aprovadas e alertas operacionais autorizados. Em **Conta → Alterar minha senha**, o motorista usa o mesmo formulário da gestão; essa ação exige conexão e preserva a sessão atual, revogando as outras sessões conforme as regras de segurança da API. Aplicar também a migration `20261102120000_notificacoes` antes de publicar esta versão.

**Ver todas as viagens** abre a lista unificada com filtros Todas, Administrativas e SVO. A lista administrativa inclui passageiros, material biológico, documentos/insumos e transporte misto, com horário e veículo quando disponíveis. Selecionar uma viagem atualiza o destino no mapa; iniciar exige a confirmação do veículo e checklist. Ordens SVO do mesmo veículo aparecem agrupadas em uma única saída.

A localização pode ser centralizada pelo botão sobre o mapa. Movimentar o mapa manualmente não causa recentralização a cada atualização de GPS; uma nova rota enquadra o percurso novamente. Sem tarefas atribuídas, a interface informa esse estado e permite atualizar a lista. A estimativa de tempo/distância aparece somente quando há uma rota calculada.

## Fluxos

Administrativo: aprovação continua na central. O motorista confirma o veículo, registra odômetro e checklist e inicia a saída online. O retorno conclui solicitação e execução na mesma transação e libera veículo/motorista.

SVO: com o módulo habilitado, emissão deixa a ordem em `AGUARDANDO_DESPACHO`. Uma saída reúne todas as ordens abertas do mesmo motorista e veículo na sequência definida pela central. Ordens antigas `EM_ANDAMENTO` podem ser incorporadas. Cada coleta deve ser registrada em sequência; no retorno, todas são concluídas e o veículo entra em `DESINFECCAO`. A confirmação de desinfecção continua no módulo SVO. Não acrescentar ordens a uma saída já iniciada.

O diário impede uso simultâneo de motorista/veículo entre operações. Aprovação e emissão usam as mesmas chaves de bloqueio. Checklists versão 1 incluem pneus, iluminação, freios, fluidos, equipamentos/documentos e limpeza. Problemas exigem descrição; pneus, iluminação e freios impedem início. Odômetro final não pode regredir em relação à saída, ao veículo ou a abastecimentos registrados.

Registros legados sem coordenadas continuam operáveis e mostram indisponibilidade de rota. Endereços não são geocodificados automaticamente. O OSRM recebe somente coordenadas; usa o próximo destino autorizado e a ordem estabelecida pela central. Não há trânsito ao vivo nem otimização automática das paradas.

## Offline, rastreamento e sessão

O service worker gerado no build guarda somente arquivos estáticos. APIs autenticadas não entram no cache HTTP. A primeira abertura exige conexão. Atualizações do service worker aguardam as páginas antigas serem fechadas, evitando trocar o código durante uma saída.

IndexedDB guarda, por usuário, a saída, última rota, posições e comandos pendentes. Permite continuar uma saída confirmada, registrar coletas, abastecimentos e encerramento offline. Iniciar nova saída exige conexão e sincronização da anterior. Novo cálculo e mapa completo exigem internet.

A sincronização revalida o usuário, renova CSRF, envia posições em lotes de 50 e processa os comandos em ordem, deixando o encerramento ao final. UUIDs e transações impedem efeitos duplicados. Lançamentos rejeitados ficam visíveis com formulário de correção. Pendências de outro usuário não são exibidas nem enviadas. Logout limpa dados já sincronizados e preserva pendências para novo login do proprietário.

A identidade mínima de uma sessão já confirmada fica no `sessionStorage`, sem token/senha, para reabertura offline na mesma aba. Dados locais permanecem sujeitos à validade da sessão; um aparelho sem contexto prévio exige novo login online. A autorização definitiva continua na API.

A captura usa GPS somente com PWA visível: a cada 5 segundos em movimento ou quando a velocidade é desconhecida; 30 segundos parado. Web Locks evita captura/sincronização duplicada entre abas compatíveis. A central consulta a cada 5 segundos, marca atraso a partir de 30 segundos e ausência de atualização a partir de 2 minutos. Não existe garantia de GPS com tela bloqueada ou app em segundo plano.

Durante saída ativa, o limite de inatividade é suspenso somente com PWA visível e confirmação recente da API (até 2 minutos). Sem rede, usa a confirmação anterior. O limite absoluto da sessão não é prorrogado: ao expirar, novo login é obrigatório. Posições e chamadas comuns não renovam a exceção.

## Servidor OSRM

Executar em servidor Linux separado, com Docker Compose, curl e `osmium-tool`. Começar com 4 vCPU, 8 GB RAM e 20 GB de disco livre; medir consumo e latência antes do piloto. Dados maiores exigem redimensionamento. A Cloudflare executa web/API; o OSRM não roda dentro do Worker.

A configuração fica em `infra/osrm`. A imagem fixada é `ghcr.io/project-osrm/osrm-backend:v6.0.0`, com perfil `car.lua` e algoritmo MLD. O script baixa o extrato Nordeste da Geofabrik e recorta Sergipe com margem de fronteira; a cobertura real é o retângulo do script, incluindo pequenas áreas vizinhas.

```bash
bash infra/osrm/prepare.sh
```

O script produz um diretório `data/candidate.*` sem trocar a base em uso. Antes de promover, testar o candidato com `osrm-routed --algorithm mld` e uma consulta de rota entre pontos conhecidos de Aracaju. Com o candidato validado, parar o serviço, mover o diretório `current` para um diretório datado de backup, mover o candidato para `current` e iniciar novamente:

```bash
export OSRM_TOKEN="segredo-aleatorio-do-proxy"
docker compose -f infra/osrm/compose.yml up -d
```

O gateway escuta **somente em 127.0.0.1:5000**, exige `Authorization: Bearer ...` e limita requisições. Publicar por proxy HTTPS ou túnel até esse gateway; manter a porta direta do OSRM privada. A URL configurada na API aponta ao gateway. Manter o mesmo segredo na API e no servidor.

Os arquivos `rota-osrm-update.service` e `.timer` preparam o candidato no primeiro dia de cada mês às 04:00 UTC. Instalar em `/etc/systemd/system`, ajustar `/opt/rota` e o usuário `rota` ao servidor e habilitar com `systemctl enable --now rota-osrm-update.timer`. O usuário do serviço precisa de acesso ao Docker e de escrita no diretório de dados. Validar e promover o candidato separadamente; preservar o diretório anterior para rollback. A troca de dados não acontece automaticamente após um download. Rotas fora da cobertura retornam mensagem ao usuário, sem impedir o diário.

Fontes: [OSRM](https://github.com/Project-OSRM/osrm-backend), [imagem fixada](https://github.com/Project-OSRM/osrm-backend/pkgs/container/osrm-backend/399470569?tag=v6.0.0), [dados Geofabrik](https://download.geofabrik.de/south-america/brazil/), [OpenFreeMap](https://openfreemap.org/quick_start/).

## Retenção e observabilidade

O Worker tem agendamento diário às 06:00 UTC (03:00 em São Paulo) para remover posições com mais de 90 dias, inclusive a última posição quando antiga. O índice por horário apoia a limpeza. O diário e a auditoria operacional permanecem no banco. Em execução somente Node, configurar a mesma limpeza no agendador da infraestrutura.

Logs estruturados do OSRM registram duração e resultado sem coordenadas ou credenciais. A central mostra idade e precisão das posições. A interface apresenta falhas de sincronização e pendências corrigíveis. Antes do piloto, monitorar percentis de latência do OSRM, erros HTTP e atrasos de posição pelo painel/logs da hospedagem.

## Validação

```bash
npm test
npm run test:integration:driver
npm run test:e2e
npm run lint
npm run test:deploy
npm run build
npm run cloudflare:check
```

O teste de integração inicia um contêiner PostGIS exclusivo, com porta aleatória e credenciais sintéticas, aplica todas as migrations, testa geometria, concorrência e transações e remove somente esse contêiner ao terminar. **Não usa o Neon nem os arquivos .env como destino.** Requer Docker ativo.

Os testes de navegador usam respostas de API controladas e verificam saída, GPS negado, lançamento offline, reconexão e histórico em desktop e viewport móvel. Para aceite operacional, repetir em Chrome Android e Safari/iOS reais, confirmar instalação, permissão de GPS, troca de aplicativo, reconexão, bateria e posição na central em até 15 segundos com rede disponível. Esses testes físicos dependem dos aparelhos e do servidor OSRM provisionado.

Desativar a flag interrompe o acesso ao módulo, mas preserva seus dados. Encerrar/sincronizar saídas ativas antes da desativação; não voltar ao fluxo legado no meio de uma saída PWA.
