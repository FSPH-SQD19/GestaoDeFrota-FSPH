CREATE EXTENSION IF NOT EXISTS postgis;

-- usuarios
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- perfis
CREATE TABLE "perfis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(50) NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "perfis_nome_key" ON "perfis"("nome");

-- usuario_perfis
CREATE TABLE "usuario_perfis" (
    "usuario_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,

    CONSTRAINT "usuario_perfis_pkey" PRIMARY KEY ("usuario_id","perfil_id")
);

CREATE INDEX "usuario_perfis_perfil_id_idx" ON "usuario_perfis"("perfil_id");

-- fornecedores
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razao_social" VARCHAR(150) NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "tipo_servico" VARCHAR(50),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fornecedores_tipo_servico_check" CHECK ("tipo_servico" IS NULL OR "tipo_servico" IN ('LOCADORA', 'OFICINA', 'POSTO_PRIME'))
);

CREATE UNIQUE INDEX "fornecedores_cnpj_key" ON "fornecedores"("cnpj");

-- veiculos
CREATE TABLE "veiculos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "placa" VARCHAR(8) NOT NULL,
    "modelo" VARCHAR(100) NOT NULL,
    "tipo_frota" VARCHAR(20) NOT NULL,
    "fornecedor_id" UUID,
    "capacidade_maxima" INTEGER NOT NULL DEFAULT 4,
    "odometro_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DISPONIVEL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "veiculos_tipo_frota_check" CHECK ("tipo_frota" IN ('ADMINISTRATIVA', 'SVO')),
    CONSTRAINT "veiculos_capacidade_maxima_check" CHECK ("capacidade_maxima" > 0),
    CONSTRAINT "veiculos_odometro_atual_check" CHECK ("odometro_atual" >= 0)
);

CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");
CREATE INDEX "veiculos_fornecedor_id_idx" ON "veiculos"("fornecedor_id");
CREATE INDEX "veiculos_tipo_frota_status_idx" ON "veiculos"("tipo_frota", "status");

-- motoristas
CREATE TABLE "motoristas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "cpf" VARCHAR(14) NOT NULL,
    "numero_cnh" VARCHAR(20) NOT NULL,
    "categoria_cnh" VARCHAR(5),
    "validade_cnh" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motoristas_usuario_id_key" ON "motoristas"("usuario_id");
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");
CREATE UNIQUE INDEX "motoristas_numero_cnh_key" ON "motoristas"("numero_cnh");
CREATE INDEX "motoristas_validade_cnh_idx" ON "motoristas"("validade_cnh");

-- documentos_veiculo
CREATE TABLE "documentos_veiculo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "veiculo_id" UUID NOT NULL,
    "tipo_documento" VARCHAR(50),
    "data_vencimento" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'VIGENTE',

    CONSTRAINT "documentos_veiculo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documentos_veiculo_tipo_documento_check" CHECK ("tipo_documento" IS NULL OR "tipo_documento" IN ('CRLV', 'IPVA', 'SEGURO'))
);

CREATE INDEX "documentos_veiculo_veiculo_id_idx" ON "documentos_veiculo"("veiculo_id");
CREATE INDEX "documentos_veiculo_data_vencimento_idx" ON "documentos_veiculo"("data_vencimento");

-- manutencoes
CREATE TABLE "manutencoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "veiculo_id" UUID NOT NULL,
    "fornecedor_id" UUID,
    "tipo" VARCHAR(20),
    "descricao" TEXT,
    "odometro_registro" DECIMAL(10,2),
    "custo_total" DECIMAL(12,2),
    "data_manutencao" DATE,

    CONSTRAINT "manutencoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "manutencoes_tipo_check" CHECK ("tipo" IS NULL OR "tipo" IN ('PREVENTIVA', 'CORRETIVA')),
    CONSTRAINT "manutencoes_custo_total_check" CHECK ("custo_total" IS NULL OR "custo_total" >= 0)
);

CREATE INDEX "manutencoes_veiculo_id_data_manutencao_idx" ON "manutencoes"("veiculo_id", "data_manutencao");
CREATE INDEX "manutencoes_fornecedor_id_idx" ON "manutencoes"("fornecedor_id");

-- abastecimentos
CREATE TABLE "abastecimentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "veiculo_id" UUID NOT NULL,
    "motorista_id" UUID,
    "fornecedor_id" UUID,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometro" DECIMAL(10,2),
    "litros" DECIMAL(8,2),
    "valor_total" DECIMAL(10,2),

    CONSTRAINT "abastecimentos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "abastecimentos_litros_check" CHECK ("litros" IS NULL OR "litros" > 0),
    CONSTRAINT "abastecimentos_valor_total_check" CHECK ("valor_total" IS NULL OR "valor_total" >= 0)
);

CREATE INDEX "abastecimentos_veiculo_id_data_hora_idx" ON "abastecimentos"("veiculo_id", "data_hora");
CREATE INDEX "abastecimentos_motorista_id_idx" ON "abastecimentos"("motorista_id");
CREATE INDEX "abastecimentos_fornecedor_id_idx" ON "abastecimentos"("fornecedor_id");

-- solicitacoes_viagem
CREATE TABLE "solicitacoes_viagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitante_id" UUID NOT NULL,
    "setor_origem" VARCHAR(100),
    "data_hora_pretendida" TIMESTAMP(3),
    "origem" TEXT,
    "destino" TEXT,
    "urgencia" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    "veiculo_alocado_id" UUID,
    "motorista_alocado_id" UUID,

    CONSTRAINT "solicitacoes_viagem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_viagem_solicitante_id_idx" ON "solicitacoes_viagem"("solicitante_id");
CREATE INDEX "solicitacoes_viagem_status_data_hora_pretendida_idx" ON "solicitacoes_viagem"("status", "data_hora_pretendida");
CREATE INDEX "solicitacoes_viagem_veiculo_alocado_id_idx" ON "solicitacoes_viagem"("veiculo_alocado_id");
CREATE INDEX "solicitacoes_viagem_motorista_alocado_id_idx" ON "solicitacoes_viagem"("motorista_alocado_id");

-- execucoes_viagem
CREATE TABLE "execucoes_viagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitacao_id" UUID NOT NULL,
    "data_hora_inicio" TIMESTAMP(3),
    "data_hora_fim" TIMESTAMP(3),
    "km_inicial" DECIMAL(10,2),
    "km_final" DECIMAL(10,2),
    "checklist_saida" JSONB,
    "checklist_retorno" JSONB,

    CONSTRAINT "execucoes_viagem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "execucoes_viagem_periodo_check" CHECK ("data_hora_fim" IS NULL OR "data_hora_inicio" IS NULL OR "data_hora_fim" >= "data_hora_inicio"),
    CONSTRAINT "execucoes_viagem_km_check" CHECK ("km_final" IS NULL OR "km_inicial" IS NULL OR "km_final" >= "km_inicial")
);

CREATE UNIQUE INDEX "execucoes_viagem_solicitacao_id_key" ON "execucoes_viagem"("solicitacao_id");

-- chamados_svo
CREATE TABLE "chamados_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_protocolo" VARCHAR(20),
    "atendente_id" UUID,
    "nome_falecido" VARCHAR(150),
    "endereco_ocorrencia" TEXT,
    "localizacao_geo" geometry(Point, 4326),
    "relato_ocorrencia" TEXT,
    "status_triagem" VARCHAR(30) NOT NULL DEFAULT 'EM_ANALISE',

    CONSTRAINT "chamados_svo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamados_svo_numero_protocolo_key" ON "chamados_svo"("numero_protocolo");
CREATE INDEX "chamados_svo_atendente_id_idx" ON "chamados_svo"("atendente_id");
CREATE INDEX "chamados_svo_status_triagem_idx" ON "chamados_svo"("status_triagem");
CREATE INDEX "chamados_svo_localizacao_geo_idx" ON "chamados_svo" USING GIST ("localizacao_geo");

-- ordens_coleta_svo
CREATE TABLE "ordens_coleta_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chamado_id" UUID NOT NULL,
    "veiculo_id" UUID,
    "motorista_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_DESPACHO',
    "numero_declaracao_obito" VARCHAR(50),
    "data_hora_saida" TIMESTAMP(3),

    CONSTRAINT "ordens_coleta_svo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordens_coleta_svo_chamado_id_key" ON "ordens_coleta_svo"("chamado_id");
CREATE INDEX "ordens_coleta_svo_veiculo_id_idx" ON "ordens_coleta_svo"("veiculo_id");
CREATE INDEX "ordens_coleta_svo_motorista_id_idx" ON "ordens_coleta_svo"("motorista_id");
CREATE INDEX "ordens_coleta_svo_status_idx" ON "ordens_coleta_svo"("status");

-- desinfeccoes_svo
CREATE TABLE "desinfeccoes_svo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "veiculo_id" UUID NOT NULL,
    "responsavel_id" UUID,
    "data_hora_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_hora_conclusao" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',

    CONSTRAINT "desinfeccoes_svo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "desinfeccoes_svo_periodo_check" CHECK ("data_hora_conclusao" IS NULL OR "data_hora_conclusao" >= "data_hora_inicio")
);

CREATE INDEX "desinfeccoes_svo_veiculo_id_data_hora_inicio_idx" ON "desinfeccoes_svo"("veiculo_id", "data_hora_inicio");
CREATE INDEX "desinfeccoes_svo_responsavel_id_idx" ON "desinfeccoes_svo"("responsavel_id");

-- auditoria_sistema
CREATE TABLE "auditoria_sistema" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "acao" VARCHAR(50),
    "tabela_afetada" VARCHAR(50),
    "registro_id" UUID,
    "dados_novos" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_sistema_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_sistema_usuario_id_idx" ON "auditoria_sistema"("usuario_id");
CREATE INDEX "auditoria_sistema_tabela_afetada_registro_id_idx" ON "auditoria_sistema"("tabela_afetada", "registro_id");
CREATE INDEX "auditoria_sistema_criado_em_idx" ON "auditoria_sistema"("criado_em");

-- foreign keys
ALTER TABLE "usuario_perfis" ADD CONSTRAINT "usuario_perfis_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_perfis" ADD CONSTRAINT "usuario_perfis_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documentos_veiculo" ADD CONSTRAINT "documentos_veiculo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_viagem" ADD CONSTRAINT "solicitacoes_viagem_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_viagem" ADD CONSTRAINT "solicitacoes_viagem_veiculo_alocado_id_fkey" FOREIGN KEY ("veiculo_alocado_id") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_viagem" ADD CONSTRAINT "solicitacoes_viagem_motorista_alocado_id_fkey" FOREIGN KEY ("motorista_alocado_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "execucoes_viagem" ADD CONSTRAINT "execucoes_viagem_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chamados_svo" ADD CONSTRAINT "chamados_svo_atendente_id_fkey" FOREIGN KEY ("atendente_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordens_coleta_svo" ADD CONSTRAINT "ordens_coleta_svo_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "chamados_svo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordens_coleta_svo" ADD CONSTRAINT "ordens_coleta_svo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordens_coleta_svo" ADD CONSTRAINT "ordens_coleta_svo_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "desinfeccoes_svo" ADD CONSTRAINT "desinfeccoes_svo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "desinfeccoes_svo" ADD CONSTRAINT "desinfeccoes_svo_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "auditoria_sistema" ADD CONSTRAINT "auditoria_sistema_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- seed perfis
INSERT INTO "perfis" ("nome", "descricao") VALUES
    ('ADMIN', 'Administrador do sistema'),
    ('GESTOR', 'Gestor da frota'),
    ('MOTORISTA', 'Motorista'),
    ('SVO', 'Servico de Verificacao de Obitos')
ON CONFLICT ("nome") DO NOTHING;