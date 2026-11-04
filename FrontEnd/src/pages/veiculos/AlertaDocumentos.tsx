import { useEffect, useState } from 'react';

interface DocumentoVeiculo {
  id?: string;
  nome?: string;
  tipo?: string;
  dataVencimento?: string;
  data_vencimento?: string;
}

interface Props {
  veiculoId: string;
}

export default function AlertaDocumentos({ veiculoId }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoVeiculo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarDocumentos() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3000/api/veiculos/${veiculoId}/documentos`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data: DocumentoVeiculo[] = await response.json();
          setDocumentos(data);
        }
      } catch (error) {
        console.error("Erro ao buscar documentos do veículo:", error);
      } finally {
        setLoading(false);
      }
    }

    if (veiculoId) carregarDocumentos();
  }, [veiculoId]);

  if (loading) return <p className="text-sm text-gray-500">Verificando documentos...</p>;
  if (!documentos || documentos.length === 0) return null;

  const hoje = new Date();

  return (
    <div className="space-y-2 my-4">
      <h3 className="text-md font-semibold text-gray-700">🚨 Alertas de Vencimento</h3>
      {documentos.map((doc: DocumentoVeiculo, index: number) => {
        const rawDate = doc.dataVencimento || doc.data_vencimento;
        if (!rawDate) return null;

        const vencimento = new Date(rawDate);
        const diffDays = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 30) return null;

        const isVencido = diffDays < 0;
        const estiloBadge = isVencido
          ? 'bg-red-100 border-red-300 text-red-800'
          : 'bg-yellow-100 border-yellow-300 text-yellow-800';

        return (
          <div key={doc.id || index} className={`p-3 rounded-md border ${estiloBadge} flex justify-between items-center text-sm font-medium`}>
            <span>📄 {doc.nome || doc.tipo || 'Documento'}</span>
            <span>
              {isVencido
                ? `⚠️ Vencido há ${Math.abs(diffDays)} dias!`
                : `⚠️ Vence em ${diffDays} dias`}
            </span>
          </div>
        );
      })}
    </div>
  );
}