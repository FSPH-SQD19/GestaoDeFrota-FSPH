CREATE SEQUENCE "solicitacoes_externas_svo_protocolo_seq";

CREATE TABLE "solicitacoes_externas_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "protocolo" VARCHAR(20) NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "chave_idempotencia" UUID NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "contato_nome" VARCHAR(150) NOT NULL,
    "contato_telefone" VARCHAR(11) NOT NULL,
    "contato_email" VARCHAR(150),
    "endereco_ocorrencia" VARCHAR(300) NOT NULL,
    "relato_ocorrencia" VARCHAR(2000) NOT NULL,
    "mensagem_solicitante" VARCHAR(500),
    "atendente_triagem_id" UUID,
    "triada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_externas_svo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "solicitacoes_externas_svo_estado_check" CHECK ("estado" IN (
        'AGUARDANDO_TRIAGEM', 'AGUARDANDO_COMPLEMENTACAO', 'AGUARDANDO_GESTOR', 'APROVADA', 'RECUSADA'
    )),
    CONSTRAINT "solicitacoes_externas_svo_complementacao_check"
        CHECK ("estado" <> 'AGUARDANDO_COMPLEMENTACAO' OR "mensagem_solicitante" IS NOT NULL),
    CONSTRAINT "solicitacoes_externas_svo_triagem_check"
        CHECK ("estado" NOT IN ('AGUARDANDO_GESTOR', 'APROVADA')
            OR ("atendente_triagem_id" IS NOT NULL AND "triada_em" IS NOT NULL))
);

-- (Sucumba Anderson)
CREATE UNIQUE INDEX "solicitacoes_externas_svo_protocolo_key" ON "solicitacoes_externas_svo"("protocolo");
CREATE UNIQUE INDEX "sol_ext_svo_solicitante_chave_key" ON "solicitacoes_externas_svo"("solicitante_id", "chave_idempotencia");
CREATE INDEX "solicitacoes_externas_svo_solicitante_id_criado_em_idx" ON "solicitacoes_externas_svo"("solicitante_id", "criado_em");
CREATE INDEX "solicitacoes_externas_svo_estado_criado_em_idx" ON "solicitacoes_externas_svo"("estado", "criado_em");

ALTER TABLE "solicitacoes_externas_svo" ADD CONSTRAINT "solicitacoes_externas_svo_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "solicitacoes_externas_svo_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "estado_anterior" VARCHAR(30),
    "estado_novo" VARCHAR(30) NOT NULL,
    "autor_id" UUID,
    "conteudo" VARCHAR(2000),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_externas_svo_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sol_ext_svo_hist_solicitacao_criado_idx" ON "solicitacoes_externas_svo_historico"("solicitacao_id", "criado_em");

ALTER TABLE "solicitacoes_externas_svo_historico" ADD CONSTRAINT "solicitacoes_externas_svo_historico_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_externas_svo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
