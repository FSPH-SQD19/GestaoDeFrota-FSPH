-- Origem do chamado SVO: chamados por telefone preservam o valor padrão.
ALTER TABLE "chamados_svo"
    ADD COLUMN "origem" VARCHAR(20) NOT NULL DEFAULT 'TELEFONE';

ALTER TABLE "chamados_svo"
    ADD CONSTRAINT "chamados_svo_origem_check"
    CHECK ("origem" IN ('TELEFONE', 'EXTERNA'));

-- A tabela de solicitações já possui gestor_decisao_id, decidida_em e chamado_svo_id.
ALTER TABLE "solicitacoes_externas_svo"
    ADD COLUMN "chave_idempotencia_decisao" VARCHAR(100);

CREATE UNIQUE INDEX "sol_ext_svo_gestor_chave_decisao_key"
    ON "solicitacoes_externas_svo" ("gestor_decisao_id", "chave_idempotencia_decisao");

-- Preserva o vínculo: não se pode remover um chamado aprovado por uma solicitação.
ALTER TABLE "solicitacoes_externas_svo"
    DROP CONSTRAINT "solicitacoes_externas_svo_chamado_svo_id_fkey";

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_chamado_svo_id_fkey"
    FOREIGN KEY ("chamado_svo_id") REFERENCES "chamados_svo"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOT VALID evita bloquear o deploy por registros legados; novas gravações ficam protegidas.
ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_aprovada_check"
    CHECK ("status" <> 'APROVADA' OR (
        "gestor_decisao_id" IS NOT NULL AND
        "decidida_em" IS NOT NULL AND
        "chamado_svo_id" IS NOT NULL
    )) NOT VALID,
    ADD CONSTRAINT "solicitacoes_externas_svo_autoaprovacao_check"
    CHECK ("gestor_decisao_id" IS NULL OR "atendente_triagem_id" IS NULL OR
        "gestor_decisao_id" <> "atendente_triagem_id") NOT VALID;
