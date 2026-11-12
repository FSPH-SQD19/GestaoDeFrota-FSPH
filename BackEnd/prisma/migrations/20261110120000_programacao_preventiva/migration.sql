ALTER TABLE "manutencoes"
  ADD COLUMN "inicio_previsto" TIMESTAMP(3),
  ADD COLUMN "fim_previsto" TIMESTAMP(3),
  ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_janela_preventiva_check"
CHECK (
  ("inicio_previsto" IS NULL AND "fim_previsto" IS NULL)
  OR
  ("inicio_previsto" IS NOT NULL AND "fim_previsto" IS NOT NULL
    AND "inicio_previsto" < "fim_previsto" AND "tipo" = 'PREVENTIVA')
);

ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_programada_janela_check"
CHECK ("status" <> 'PROGRAMADA' OR ("inicio_previsto" IS NOT NULL AND "fim_previsto" IS NOT NULL));

CREATE INDEX "manutencoes_veiculo_id_status_inicio_previsto_fim_previsto_idx"
ON "manutencoes" ("veiculo_id", "status", "inicio_previsto", "fim_previsto");
