-- Migration: S19FROTA-279 — Solicitação Externa SVO e Histórico Imutável
-- Rollback seguro:
--   DROP TABLE IF EXISTS "solicitacoes_externas_svo_historico";
--   DROP TABLE IF EXISTS "solicitacoes_externas_svo";

CREATE TABLE "solicitacoes_externas_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "protocolo" VARCHAR(20) NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "nome_contato" VARCHAR(150) NOT NULL,
    "telefone_contato" VARCHAR(20) NOT NULL,
    "tipo_solicitante" VARCHAR(40) NOT NULL DEFAULT 'FAMILIAR',
    "instituicao_solicitante" VARCHAR(150),
    "nome_falecido" VARCHAR(150) NOT NULL,
    "endereco_ocorrencia" VARCHAR(300) NOT NULL,
    "municipio_ocorrencia" VARCHAR(100),
    "ponto_referencia" VARCHAR(200),
    "relato_ocorrencia" VARCHAR(1000) NOT NULL,
    "complementacao_solicitada" VARCHAR(500),
    "complementacao_enviada" VARCHAR(1000),
    "status" VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "atendente_triagem_id" UUID,
    "triada_em" TIMESTAMP(3),
    "observacao_triagem" VARCHAR(500),
    "gestor_decisao_id" UUID,
    "decidida_em" TIMESTAMP(3),
    "justificativa_decisao" VARCHAR(500),
    "motivo_recusa" VARCHAR(500),
    "chamado_svo_id" UUID,
    "chave_idempotencia" VARCHAR(100),
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_externas_svo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "solicitacoes_externas_svo_status_check" CHECK (
        "status" IN (
            'AGUARDANDO_TRIAGEM',
            'AGUARDANDO_COMPLEMENTACAO',
            'AGUARDANDO_GESTOR',
            'APROVADA',
            'RECUSADA'
        )
    )
);

CREATE UNIQUE INDEX "solicitacoes_externas_svo_protocolo_key" ON "solicitacoes_externas_svo"("protocolo");
CREATE UNIQUE INDEX "solicitacoes_externas_svo_chamado_svo_id_key" ON "solicitacoes_externas_svo"("chamado_svo_id");
CREATE UNIQUE INDEX "solicitacoes_externas_svo_chave_idempotencia_key" ON "solicitacoes_externas_svo"("chave_idempotencia");
CREATE INDEX "solicitacoes_externas_svo_solicitante_id_criado_em_idx" ON "solicitacoes_externas_svo"("solicitante_id", "criado_em");
CREATE INDEX "solicitacoes_externas_svo_status_criado_em_idx" ON "solicitacoes_externas_svo"("status", "criado_em");
CREATE INDEX "solicitacoes_externas_svo_atendente_triagem_id_idx" ON "solicitacoes_externas_svo"("atendente_triagem_id");
CREATE INDEX "solicitacoes_externas_svo_gestor_decisao_id_idx" ON "solicitacoes_externas_svo"("gestor_decisao_id");

CREATE TABLE "solicitacoes_externas_svo_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_externa_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "perfil_autor" VARCHAR(30) NOT NULL,
    "acao" VARCHAR(50) NOT NULL,
    "status_anterior" VARCHAR(40),
    "status_novo" VARCHAR(40) NOT NULL,
    "mensagem_publica" VARCHAR(500),
    "observacao_interna" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_externas_svo_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_externas_svo_historico_solicitacao_externa_id__idx" ON "solicitacoes_externas_svo_historico"("solicitacao_externa_id", "criado_em");
CREATE INDEX "solicitacoes_externas_svo_historico_autor_id_idx" ON "solicitacoes_externas_svo_historico"("autor_id");

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_solicitante_id_fkey"
    FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_atendente_triagem_id_fkey"
    FOREIGN KEY ("atendente_triagem_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_gestor_decisao_id_fkey"
    FOREIGN KEY ("gestor_decisao_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo"
    ADD CONSTRAINT "solicitacoes_externas_svo_chamado_svo_id_fkey"
    FOREIGN KEY ("chamado_svo_id") REFERENCES "chamados_svo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo_historico"
    ADD CONSTRAINT "solicitacoes_externas_svo_historico_solicitacao_externa_id_fkey"
    FOREIGN KEY ("solicitacao_externa_id") REFERENCES "solicitacoes_externas_svo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_externas_svo_historico"
    ADD CONSTRAINT "solicitacoes_externas_svo_historico_autor_id_fkey"
    FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
