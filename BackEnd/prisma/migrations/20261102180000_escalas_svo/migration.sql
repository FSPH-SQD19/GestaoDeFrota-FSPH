CREATE TABLE "escalas_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "motorista_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "inicio_turno" TIMESTAMP(3) NOT NULL,
    "fim_turno" TIMESTAMP(3) NOT NULL,
    "observacoes" VARCHAR(300),
    "encerrada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalas_svo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "escalas_svo_turno_check"
        CHECK ("fim_turno" > "inicio_turno" AND "fim_turno" - "inicio_turno" <= INTERVAL '24 hours')
);

CREATE INDEX "escalas_svo_motorista_id_inicio_turno_idx" ON "escalas_svo"("motorista_id", "inicio_turno");

CREATE INDEX "escalas_svo_veiculo_id_inicio_turno_idx" ON "escalas_svo"("veiculo_id", "inicio_turno");

CREATE INDEX "escalas_svo_inicio_turno_fim_turno_idx" ON "escalas_svo"("inicio_turno", "fim_turno");

ALTER TABLE "escalas_svo" ADD CONSTRAINT "escalas_svo_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "escalas_svo" ADD CONSTRAINT "escalas_svo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;