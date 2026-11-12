-- AlterTable
ALTER TABLE "solicitacoes_viagem" ADD COLUMN     "destino_coordenadas" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "origem_coordenadas" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- AlterTable
ALTER TABLE "ordens_coleta_svo" ADD COLUMN     "base_coordenadas" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "sequencia" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "saidas_operacionais" (
    "id" UUID NOT NULL,
    "motorista_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "solicitacao_id" UUID,
    "tipo" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "km_inicial" DECIMAL(10,2) NOT NULL,
    "km_final" DECIMAL(10,2),
    "checklist_saida" JSONB NOT NULL,
    "checklist_retorno" JSONB,
    "pontos" JSONB NOT NULL,
    "ocorrencias" TEXT,

    CONSTRAINT "saidas_operacionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saida_ordens" (
    "ordem_id" UUID NOT NULL,
    "saida_id" UUID NOT NULL,
    "visitada_em" TIMESTAMP(3),

    CONSTRAINT "saida_ordens_pkey" PRIMARY KEY ("ordem_id")
);

-- CreateTable
CREATE TABLE "comandos_saida" (
    "id" UUID NOT NULL,
    "saida_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comandos_saida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locais_operacionais" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "coordenadas" DOUBLE PRECISION[],
    "tipo" VARCHAR(20) NOT NULL,

    CONSTRAINT "locais_operacionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posicoes_saida" (
    "id" UUID NOT NULL,
    "saida_id" UUID NOT NULL,
    "ponto" geography(Point,4326) NOT NULL,
    "capturada_em" TIMESTAMP(3) NOT NULL,
    "recebida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precisao" DOUBLE PRECISION NOT NULL,
    "velocidade" DOUBLE PRECISION,
    "direcao" DOUBLE PRECISION,

    CONSTRAINT "posicoes_saida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ultimas_posicoes_saida" (
    "saida_id" UUID NOT NULL,
    "amostra_id" UUID NOT NULL,
    "ponto" geography(Point,4326) NOT NULL,
    "capturada_em" TIMESTAMP(3) NOT NULL,
    "recebida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precisao" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ultimas_posicoes_saida_pkey" PRIMARY KEY ("saida_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saidas_operacionais_solicitacao_id_key" ON "saidas_operacionais"("solicitacao_id");

-- CreateIndex
CREATE INDEX "saidas_operacionais_motorista_id_inicio_idx" ON "saidas_operacionais"("motorista_id", "inicio");

-- CreateIndex
CREATE INDEX "posicoes_saida_ponto_idx" ON "posicoes_saida" USING GIST ("ponto");

-- CreateIndex
CREATE INDEX "posicoes_saida_saida_id_capturada_em_idx" ON "posicoes_saida"("saida_id", "capturada_em");

-- CreateIndex
CREATE INDEX "ultimas_posicoes_saida_ponto_idx" ON "ultimas_posicoes_saida" USING GIST ("ponto");

-- AddForeignKey
ALTER TABLE "saida_ordens" ADD CONSTRAINT "saida_ordens_saida_id_fkey" FOREIGN KEY ("saida_id") REFERENCES "saidas_operacionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandos_saida" ADD CONSTRAINT "comandos_saida_saida_id_fkey" FOREIGN KEY ("saida_id") REFERENCES "saidas_operacionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE saidas_operacionais ADD CONSTRAINT saidas_motorista_fk FOREIGN KEY (motorista_id) REFERENCES motoristas(id);
ALTER TABLE saidas_operacionais ADD CONSTRAINT saidas_veiculo_fk FOREIGN KEY (veiculo_id) REFERENCES veiculos(id);
ALTER TABLE saidas_operacionais ADD CONSTRAINT saidas_solicitacao_fk FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_viagem(id);
ALTER TABLE saida_ordens ADD CONSTRAINT saida_ordem_fk FOREIGN KEY (ordem_id) REFERENCES ordens_coleta_svo(id);
ALTER TABLE posicoes_saida ADD CONSTRAINT posicoes_saida_fk FOREIGN KEY (saida_id) REFERENCES saidas_operacionais(id);
ALTER TABLE ultimas_posicoes_saida ADD CONSTRAINT ultima_saida_fk FOREIGN KEY (saida_id) REFERENCES saidas_operacionais(id);
CREATE UNIQUE INDEX saida_motorista_ativa ON saidas_operacionais(motorista_id) WHERE status='EM_ANDAMENTO';
CREATE UNIQUE INDEX saida_veiculo_ativa ON saidas_operacionais(veiculo_id) WHERE status='EM_ANDAMENTO';
ALTER TABLE saidas_operacionais ADD CONSTRAINT saida_tipo_check CHECK (tipo IN ('SVO','ADMINISTRATIVA'));
ALTER TABLE saidas_operacionais ADD CONSTRAINT saida_status_check CHECK (status IN ('EM_ANDAMENTO','CONCLUIDA'));
ALTER TABLE saidas_operacionais ADD CONSTRAINT saida_vinculo_check CHECK ((tipo='ADMINISTRATIVA' AND solicitacao_id IS NOT NULL) OR (tipo='SVO' AND solicitacao_id IS NULL));
ALTER TABLE saidas_operacionais ADD CONSTRAINT saida_km_check CHECK (km_inicial >= 0 AND (km_final IS NULL OR km_final >= km_inicial));

CREATE INDEX posicoes_retencao ON posicoes_saida(capturada_em);
