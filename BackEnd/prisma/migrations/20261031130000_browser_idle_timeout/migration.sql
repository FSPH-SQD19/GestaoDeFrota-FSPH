-- A inatividade é acompanhada pela interface; a sessão permanece revogável.
ALTER TABLE "auth_sessoes" DROP COLUMN "ultimo_acesso";
