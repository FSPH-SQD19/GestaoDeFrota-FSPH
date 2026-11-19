# Reteste após rebuild Docker — 19/11/2026

## Ambiente e imagens

- Branch: `doc_Qa`; alterações locais ainda não commitadas
- Frontend e backend reconstruídos pelo usuário; containers recriados nesta rodada
- Imagem backend: `sha256:7eac5d94ddde892983dd9e73aaf96ac0704e79ca2f82cf50885bfd9798173787`
- Imagem frontend: `sha256:072e2e913e5c2a7ab032b9ebe509bdf4f43a2868a7ff762967289c75c6d3e09f`
- URL E2E: `http://127.0.0.1:5173`; API encaminhada pelo Nginx
- Banco: PostgreSQL de desenvolvimento; `prisma migrate status` confirmou 24 migrações, schema em dia
- A migração `20261118120000_manutencao_status_programada_cancelada/migration.sql` foi verificada dentro da imagem backend

## Resultados E2E nos containers novos

Todos os 10 cenários Docker passaram em lotes contra os dois containers atualizados:

| Área                                                    | Cenários                                                 | Resultado                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Proxy, sessão, CSRF e login                             | Nginx                                                    | 1/1 passou                                                                                                         |
| Frota / manutenção / relatórios e solicitação de viagem | GESTOR e SOLICITANTE                                     | 2/2 passaram; manutenção também verificou janela invertida `400`, sobreposição `409`, criar `201` e cancelar `200` |
| Dupla alocação                                          | ADMIN                                                    | 1/1 passou; uma aprovação `200` e um conflito `409`                                                                |
| SVO                                                     | Telefonema, capacidade, despacho, etapas e desinfecção   | 3/3 passaram                                                                                                       |
| Segurança                                               | API sem sessão, RBAC dos cinco perfis, isolamento e CSRF | 3/3 passaram                                                                                                       |

Na primeira partida do backend recém-recriado, um teste abriu a SPA antes de a API terminar de responder e outro login não carregou a sessão. Ambos passaram nas novas tentativas após o backend aquecer. Para evitar essa corrida em futuras execuções, `playwright.docker.config.ts` agora aguarda a rota de CSRF da stack externa ficar disponível antes de iniciar os testes.

## Validações de código

- `npm test`: backend **877/877** e frontend **235/235** passaram; frontend limitado a 4 workers para evitar timeout por carga excessiva de jsdom. Dois testes de UI longos têm timeout individual de 10 s.
- `npm run build`: passou em backend e frontend; Vite emite apenas o aviso não bloqueante sobre chunks maiores que 500 kB.
- `npm run lint` e os dois `test:types`: passaram.
- `git diff --check`: passou.

## Limites do aceite

Não foi encontrado erro reproduzível nos fluxos corrigidos e retestados. MAN-01 ainda não cobre reagendamento, conclusão e veículo ocupado. A auditoria 272 mantém cenários manuais pendentes e o fluxo do usuário externo SVO aguarda a integração correspondente; não fechar a auditoria nem recomendar homologação integral.
