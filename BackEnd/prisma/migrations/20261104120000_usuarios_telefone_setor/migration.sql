-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "telefone" VARCHAR(20),
ADD COLUMN "setor" VARCHAR(100);

-- CreateIndex
CREATE INDEX "usuarios_ativo_idx" ON "usuarios"("ativo");

-- CreateIndex
CREATE INDEX "usuarios_setor_idx" ON "usuarios"("setor");
