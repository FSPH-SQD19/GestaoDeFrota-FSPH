import { useEffect, useState } from "react";
import { Button } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import type { DocumentosVeiculoResponse } from "../../types/documentoVeiculo";
import { ListaAlertasDocumentos } from "./ListaAlertasDocumentos";

interface Props {
  veiculoId: string;
}

export default function AlertaDocumentos({ veiculoId }: Props) {
  const { sessionKey } = useAuth();
  const [revisao, setRevisao] = useState(0);
  const chave = `${sessionKey}_${veiculoId}_${revisao}`;
  const [resultado, setResultado] = useState<{
    chave: string;
    dados: DocumentosVeiculoResponse | null;
    erro: string;
  } | null>(null);
  const atual = resultado?.chave === chave ? resultado : null;

  useEffect(() => {
    let ativo = true;
    void apiRequest<DocumentosVeiculoResponse>(`/veiculos/${veiculoId}/documentos`)
      .then((dados) => {
        if (ativo) setResultado({ chave, dados, erro: "" });
      })
      .catch((error: unknown) => {
        if (ativo)
          setResultado({
            chave,
            dados: null,
            erro:
              error instanceof Error ? error.message : "Não foi possível carregar os documentos.",
          });
      });
    return () => {
      ativo = false;
    };
  }, [chave, veiculoId]);

  if (!atual) return <p className="text-sm text-slate-500">Verificando documentos...</p>;
  if (atual.erro)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-rose-700">
          {atual.erro}
        </p>
        <Button variant="outline" size="sm" onClick={() => setRevisao((valor) => valor + 1)}>
          Tentar novamente
        </Button>
      </div>
    );

  const documentos =
    atual.dados?.data.filter((documento) => documento.atual && documento.situacao !== "VIGENTE") ??
    [];

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">Alertas de vencimento</h3>
      {documentos.length > 0 ? (
        <ListaAlertasDocumentos documentos={documentos} />
      ) : (
        <p className="text-sm text-slate-500">
          {atual.dados?.data.length
            ? "Nenhum documento com vencimento próximo."
            : "Nenhum documento cadastrado para este veículo."}
        </p>
      )}
    </div>
  );
}
