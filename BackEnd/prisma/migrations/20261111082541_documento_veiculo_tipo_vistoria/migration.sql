ALTER TABLE "documentos_veiculo" DROP CONSTRAINT "documentos_veiculo_tipo_documento_check";
ALTER TABLE "documentos_veiculo" ADD CONSTRAINT "documentos_veiculo_tipo_documento_check"
    CHECK ("tipo_documento" IS NULL OR "tipo_documento" IN ('CRLV', 'IPVA', 'SEGURO', 'VISTORIA'));