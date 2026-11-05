CREATE TABLE "multas_infracoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auto_infracao" VARCHAR(50) NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "motorista_id" UUID,
    "solicitacao_id" UUID,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "gravidade" VARCHAR(20) NOT NULL,
    "pontos" INTEGER NOT NULL DEFAULT 0,
    "valor" DECIMAL(10,2) NOT NULL,
    "descricao" VARCHAR(255),
    "local" VARCHAR(200),
    "orgao_emissor" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "data_vencimento" DATE,
    "data_pagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multas_infracoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "multas_infracoes_auto_infracao_key" ON "multas_infracoes"("auto_infracao");

CREATE INDEX "multas_infracoes_veiculo_id_idx" ON "multas_infracoes"("veiculo_id");
CREATE INDEX "multas_infracoes_motorista_id_idx" ON "multas_infracoes"("motorista_id");
CREATE INDEX "multas_infracoes_status_idx" ON "multas_infracoes"("status");
CREATE INDEX "multas_infracoes_data_hora_idx" ON "multas_infracoes"("data_hora");

ALTER TABLE "multas_infracoes" ADD CONSTRAINT "multas_infracoes_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "multas_infracoes" ADD CONSTRAINT "multas_infracoes_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "multas_infracoes" ADD CONSTRAINT "multas_infracoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
