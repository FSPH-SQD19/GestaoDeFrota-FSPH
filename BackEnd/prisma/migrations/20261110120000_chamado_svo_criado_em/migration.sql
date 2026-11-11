-- AlterTable
ALTER TABLE "chamados_svo" ADD COLUMN "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill from the original CRIAR audit when available.
UPDATE "chamados_svo" AS c
SET "criado_em" = a."criado_em"
FROM (
  SELECT DISTINCT ON ("registro_id") "registro_id", "criado_em"
  FROM "auditoria_sistema"
  WHERE "tabela_afetada" = 'chamados_svo'
    AND "acao" = 'CRIAR'
    AND "registro_id" IS NOT NULL
  ORDER BY "registro_id", "criado_em" ASC
) AS a
WHERE c."id" = a."registro_id";

-- CreateIndex
CREATE INDEX "chamados_svo_criado_em_idx" ON "chamados_svo"("criado_em");
