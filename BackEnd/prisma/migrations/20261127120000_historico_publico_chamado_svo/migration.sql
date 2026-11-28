ALTER TABLE "chamados_svo"
  ADD COLUMN "solicitante_id" UUID;

CREATE INDEX "chamados_svo_solicitante_id_idx"
  ON "chamados_svo"("solicitante_id");

ALTER TABLE "chamados_svo"
  ADD CONSTRAINT "chamados_svo_solicitante_id_fkey"
  FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "chamados_svo_historico" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chamado_id" UUID NOT NULL,
  "autor_id" UUID,
  "etapa" VARCHAR(40) NOT NULL,
  "mensagem_publica" VARCHAR(300) NOT NULL,
  "parecer_interno" VARCHAR(500),
  "visivel_solicitante" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamados_svo_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chamados_svo_historico_chamado_id_criado_em_idx"
  ON "chamados_svo_historico"("chamado_id", "criado_em");

ALTER TABLE "chamados_svo_historico"
  ADD CONSTRAINT "chamados_svo_historico_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "chamados_svo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chamados_svo_historico"
  ADD CONSTRAINT "chamados_svo_historico_autor_id_fkey"
  FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
