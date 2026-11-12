-- A coluna criado_em já existe em 20261110090000_svo_sla.
CREATE INDEX IF NOT EXISTS "chamados_svo_criado_em_idx" ON "chamados_svo"("criado_em");
