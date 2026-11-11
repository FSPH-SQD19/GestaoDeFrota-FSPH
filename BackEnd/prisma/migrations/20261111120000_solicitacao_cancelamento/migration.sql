ALTER TABLE "solicitacoes_viagem" ADD COLUMN "motivo_cancelamento" TEXT;

ALTER TABLE "solicitacoes_viagem" DROP CONSTRAINT IF EXISTS "solicitacoes_viagem_status_check";
ALTER TABLE "solicitacoes_viagem" ADD CONSTRAINT "solicitacoes_viagem_status_check"
    CHECK ("status" IN ('PENDENTE', 'APROVADA', 'EM_TRANSITO', 'CONCLUIDA', 'RECUSADA', 'CANCELADA'));

ALTER TABLE "solicitacoes_viagem" DROP CONSTRAINT IF EXISTS "solicitacoes_viagem_motivo_cancelamento_check";
ALTER TABLE "solicitacoes_viagem" ADD CONSTRAINT "solicitacoes_viagem_motivo_cancelamento_check"
    CHECK ("status" <> 'CANCELADA' OR ("motivo_cancelamento" IS NOT NULL AND BTRIM("motivo_cancelamento") <> ''));
