# Evidências — concorrência de alocação administrativa (FRO-03)

## Ambiente

- Data: 17/11/2026 (America/Cayenne; UTC−04:00)
- Branch de trabalho: `doc_Qa`; serviços Docker locais em execução
- Frontend de teste: Vite em `127.0.0.1:4173`; API em `127.0.0.1:3000`
- Banco: PostgreSQL de desenvolvimento; solicitações e demais dados de teste sintéticos
- Perfil: ADMIN
- Automação: `FrontEnd/tests/e2e/docker/dupla-alocacao.spec.ts`

## Execução

1. Autenticar como ADMIN usando a conta de demonstração sintética.
2. Selecionar veículo administrativo disponível e motorista ativo com CNH válida para o período.
3. Criar duas solicitações sintéticas com a mesma janela de viagem.
4. Enviar simultaneamente as duas aprovações usando o mesmo veículo e motorista.
5. Consultar os registros e cancelar ambas as fixtures para liberar os recursos.

| Resultado esperado | Resultado obtido | Status |
| --- | --- | --- |
| Apenas uma aprovação é aceita; a segunda operação recebe conflito; nenhum recurso fica alocado duas vezes. | Uma resposta 200 e uma resposta 409. A consulta confirmou uma solicitação `APROVADA` e outra `PENDENTE`, com veículo e motorista associados somente à aprovada. As duas fixtures foram canceladas com sucesso. | PASSOU |

Na primeira tentativa, a janela de 60 dias não encontrou motorista disponível com CNH válida e o teste foi pulado sem mutar dados. A janela foi ajustada para 10 dias, encontrou uma fixture elegível e concluiu a disputa com sucesso. Nomes, documentos e identificadores foram omitidos.
