CREATE TABLE "auth_sessoes" (
  "id" UUID PRIMARY KEY,
  "usuario_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "senha_versao" VARCHAR(64) NOT NULL,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "ultimo_acesso" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "auth_sessoes_usuario_id_idx" ON "auth_sessoes"("usuario_id");
CREATE INDEX "auth_sessoes_expira_em_idx" ON "auth_sessoes"("expira_em");
CREATE TABLE "auth_login_limites" (
  "chave" VARCHAR(64) PRIMARY KEY,
  "tentativas" INTEGER NOT NULL,
  "expira_em" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "auth_login_limites_expira_em_idx" ON "auth_login_limites"("expira_em");
