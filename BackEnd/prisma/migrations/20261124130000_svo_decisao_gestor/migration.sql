-- Origem do chamado SVO: o fluxo por telefone continua com o padrão TELEFONE.
ALTER TABLE "chamados_svo" ADD COLUMN "origem" VARCHAR(20) NOT NULL DEFAULT 'TELEFONE';
ALTER TABLE "chamados_svo" ADD CONSTRAINT "chamados_svo_origem_check"
    CHECK ("origem" IN ('TELEFONE', 'EXTERNA'));

-- Decisão do gestor e vínculo com o chamado SVO criado na aprovação
ALTER TABLE "solicitacoes_externas_svo"
    ADD COLUMN "gestor_decisao_id" UUID,
    ADD COLUMN "decidida_em" TIMESTAMP(3),
    ADD COLUMN "chave_idempotencia_decisao" VARCHAR(100),
    ADD COLUMN "chamado_svo_id" UUID;

CREATE UNIQUE INDEX "solicitacoes_externas_svo_chamado_svo_id_key" ON "solicitacoes_externas_svo"("chamado_svo_id");

ALTER TABLE "solicitacoes_externas_svo" ADD CONSTRAINT "solicitacoes_externas_svo_chamado_svo_id_fkey" FOREIGN KEY ("chamado_svo_id") REFERENCES "chamados_svo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_aprovada_check"
        CHECK ("estado" <> 'APROVADA'
            OR ("gestor_decisao_id" IS NOT NULL AND "decidida_em" IS NOT NULL AND "chamado_svo_id" IS NOT NULL)),
    ADD CONSTRAINT "solicitacoes_externas_svo_autoaprovacao_check"
        CHECK ("gestor_decisao_id" IS NULL OR "atendente_triagem_id" IS NULL
            OR "gestor_decisao_id" <> "atendente_triagem_id");
