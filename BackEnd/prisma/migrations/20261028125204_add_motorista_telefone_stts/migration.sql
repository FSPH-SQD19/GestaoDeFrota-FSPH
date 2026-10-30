-- AlterTable
ALTER TABLE "motoristas" ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'DISPONIVEL',
ADD COLUMN     "telefone" VARCHAR(20);

-- CreateIndex
CREATE INDEX "motoristas_status_idx" ON "motoristas"("status");
