-- Datas legadas sem auditoria permanecem desconhecidas, sem fabricar SLA.
ALTER TABLE "chamados_svo" ADD COLUMN "criado_em" TIMESTAMP(3);
UPDATE "chamados_svo" c SET "criado_em" = a.abertura
FROM (
  SELECT "registro_id", MIN("criado_em") AS abertura
  FROM "auditoria_sistema"
  WHERE "tabela_afetada" = 'chamados_svo' AND "acao" = 'CRIAR'
  GROUP BY "registro_id"
) a WHERE c."id" = a."registro_id";
ALTER TABLE "chamados_svo" ALTER COLUMN "criado_em" SET DEFAULT CURRENT_TIMESTAMP;
