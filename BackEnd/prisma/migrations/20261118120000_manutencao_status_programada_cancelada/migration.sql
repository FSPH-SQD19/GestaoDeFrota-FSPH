-- Permite os estados usados pelo fluxo de manutenção preventiva.
-- PROGRAMADA é criado ao agendar; CANCELADA é usado ao cancelar o agendamento.
ALTER TABLE "manutencoes" DROP CONSTRAINT IF EXISTS "manutencoes_status_check";

ALTER TABLE "manutencoes"
  ADD CONSTRAINT "manutencoes_status_check"
  CHECK ("status" IN ('ABERTA', 'CONCLUIDA', 'PROGRAMADA', 'CANCELADA'));
