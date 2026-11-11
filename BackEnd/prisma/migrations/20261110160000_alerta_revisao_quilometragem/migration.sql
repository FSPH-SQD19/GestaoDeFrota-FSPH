ALTER TABLE "veiculos" ADD COLUMN "km_proxima_revisao" DECIMAL(10,2);

ALTER TABLE "veiculos"
ADD CONSTRAINT "veiculos_km_proxima_revisao_positivo"
CHECK ("km_proxima_revisao" IS NULL OR "km_proxima_revisao" > 0);
