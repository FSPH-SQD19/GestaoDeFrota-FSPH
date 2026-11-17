CREATE TABLE "sedes" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "nome" VARCHAR(150) NOT NULL,
 "ativo" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sedes_nome_key" ON "sedes"("nome");
CREATE UNIQUE INDEX "sedes_nome_case_insensitive_key" ON "sedes" (LOWER("nome"));
ALTER TABLE "veiculos" ADD COLUMN "sede_id" UUID, ADD COLUMN "fora_de_sede" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sede_atualizada_em" TIMESTAMP(3);
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_sede_consistente" CHECK (NOT "fora_de_sede" OR "sede_id" IS NULL);
CREATE INDEX "veiculos_sede_id_idx" ON "veiculos"("sede_id");
