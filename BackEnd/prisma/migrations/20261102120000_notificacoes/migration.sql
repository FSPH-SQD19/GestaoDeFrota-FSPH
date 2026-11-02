CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "mensagem" VARCHAR(500) NOT NULL,
    "referencia_tipo" VARCHAR(40),
    "referencia_id" UUID,
    "chave_unica" VARCHAR(160),
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notificacoes_chave_unica_key" ON "notificacoes"("chave_unica");
CREATE INDEX "notificacoes_usuario_id_lida_criado_em_idx" ON "notificacoes"("usuario_id", "lida", "criado_em");
CREATE INDEX "notificacoes_usuario_id_criado_em_idx" ON "notificacoes"("usuario_id", "criado_em");
