-- 1. Primeiro adiciona as colunas
ALTER TABLE "manutencoes" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'ABERTA';
ALTER TABLE "manutencoes" ADD COLUMN "data_conclusao" TIMESTAMP(3);

-- 2. Depois adiciona a validação (no final do arquivo)
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_status_check" CHECK ("status" IN ('ABERTA', 'CONCLUIDA'));