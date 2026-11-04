import { Badge } from "../../components/common";
import type { DocumentoVeiculo } from "../../types/documentoVeiculo";

interface Props {
  documentos: (DocumentoVeiculo & { placa?: string })[];
}

export function ListaAlertasDocumentos({ documentos }: Props) {
  return (
    <div className="space-y-2">
      {documentos.map((documento) => (
        <div
          key={documento.id}
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-medium text-slate-800">
            {documento.placa ? `Veículo ${documento.placa} — ` : ""}
            {documento.tipoDocumento || "Documento"}
          </span>
          <Badge variant={documento.situacao === "VENCIDO" ? "danger" : "warning"}>
            {documento.diasParaVencer < 0
              ? `Vencido há ${Math.abs(documento.diasParaVencer)} dia(s)`
              : documento.diasParaVencer === 0
                ? "Vence hoje"
                : `Vence em ${documento.diasParaVencer} dia(s)`}
          </Badge>
        </div>
      ))}
    </div>
  );
}
