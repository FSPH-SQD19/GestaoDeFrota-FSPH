ALTER TABLE "manutencoes" ADD COLUMN "avaria_id" UUID;
CREATE UNIQUE INDEX "manutencoes_avaria_id_key" ON "manutencoes"("avaria_id");

CREATE TABLE "avarias_viagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "execucao_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "registrada_por_id" UUID NOT NULL,
    "analisada_por_id" UUID,
    "descricao" VARCHAR(1000) NOT NULL,
    "situacao" VARCHAR(40) NOT NULL DEFAULT 'PENDENTE',
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analisada_em" TIMESTAMP(3),
    "justificativa" VARCHAR(500),
    CONSTRAINT "avarias_viagem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "avarias_viagem_solicitacao_id_key" ON "avarias_viagem"("solicitacao_id");
CREATE UNIQUE INDEX "avarias_viagem_execucao_id_key" ON "avarias_viagem"("execucao_id");
CREATE INDEX "avarias_viagem_situacao_criada_em_idx" ON "avarias_viagem"("situacao", "criada_em");
CREATE INDEX "avarias_viagem_veiculo_id_situacao_idx" ON "avarias_viagem"("veiculo_id", "situacao");

CREATE TABLE "avarias_viagem_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "avaria_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "situacao_anterior" VARCHAR(40),
    "situacao_nova" VARCHAR(40) NOT NULL,
    "justificativa" VARCHAR(500),
    "manutencao_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avarias_viagem_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "avarias_viagem_historico_avaria_id_criado_em_idx" ON "avarias_viagem_historico"("avaria_id", "criado_em");
CREATE INDEX "avarias_viagem_historico_autor_id_idx" ON "avarias_viagem_historico"("autor_id");

ALTER TABLE "avarias_viagem" ADD CONSTRAINT "avarias_viagem_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_viagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem" ADD CONSTRAINT "avarias_viagem_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucoes_viagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem" ADD CONSTRAINT "avarias_viagem_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem" ADD CONSTRAINT "avarias_viagem_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem" ADD CONSTRAINT "avarias_viagem_analisada_por_id_fkey" FOREIGN KEY ("analisada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem_historico" ADD CONSTRAINT "avarias_viagem_historico_avaria_id_fkey" FOREIGN KEY ("avaria_id") REFERENCES "avarias_viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem_historico" ADD CONSTRAINT "avarias_viagem_historico_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "avarias_viagem_historico" ADD CONSTRAINT "avarias_viagem_historico_manutencao_id_fkey" FOREIGN KEY ("manutencao_id") REFERENCES "manutencoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_avaria_id_fkey" FOREIGN KEY ("avaria_id") REFERENCES "avarias_viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
