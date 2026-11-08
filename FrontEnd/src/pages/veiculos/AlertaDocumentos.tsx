import { useEffect, useRef, useState } from "react";
import { Button, Input, Select } from "../../components/common";
import { useAuth } from "../../contexts/auth";
import { apiRequest } from "../../lib/api";
import type { DocumentoVeiculo, DocumentosVeiculoResponse } from "../../types/documentoVeiculo";
import { documentoVeiculoSchema, TIPOS_DOCUMENTO_VEICULO } from "./veiculoRules";
import { ListaAlertasDocumentos } from "./ListaAlertasDocumentos";

interface Props {
  veiculoId: string;
}

const SITUACAO_LABEL: Record<DocumentoVeiculo["situacao"], string> = {
  VIGENTE: "Vigente",
  PROXIMO_VENCIMENTO: "Próximo do vencimento",
  VENCIDO: "Vencido",
};

const TIPO_LABEL: Record<(typeof TIPOS_DOCUMENTO_VEICULO)[number], string> = {
  CRLV: "CRLV",
  IPVA: "IPVA",
  SEGURO: "Seguro",
  VISTORIA: "Vistoria",
};

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function AlertaDocumentos({ veiculoId }: Props) {
  const { sessionKey } = useAuth();
  const [revisao, setRevisao] = useState(0);
  const salvando = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [tipoDocumento, setTipoDocumento] =
    useState<(typeof TIPOS_DOCUMENTO_VEICULO)[number]>("CRLV");
  const [dataVencimento, setDataVencimento] = useState("");
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

  const salvarDocumento = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvando.current) return;
    setFormError("");
    setSucesso("");
    const validacao = documentoVeiculoSchema.safeParse({ tipoDocumento, dataVencimento });
    if (!validacao.success) {
      setFormError(validacao.error.issues[0]?.message ?? "Revise os dados do documento.");
      return;
    }
    salvando.current = true;
    setIsSaving(true);
    try {
      await apiRequest(`/veiculos/${veiculoId}/documentos`, {
        method: "POST",
        data: validacao.data,
      });
      setDataVencimento("");
      setSucesso("Documento registrado.");
      setRevisao((valor) => valor + 1);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível registrar o documento.",
      );
    } finally {
      salvando.current = false;
      setIsSaving(false);
    }
  };

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

  const documentosAtuais = atual.dados?.data.filter((documento) => documento.atual) ?? [];
  const alertas = documentosAtuais.filter((documento) => documento.situacao !== "VIGENTE");
  const tiposSemRegistro = atual.dados?.resumo.tiposSemRegistro ?? [];

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Documentos atuais</h3>
        {documentosAtuais.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {documentosAtuais.map((documento) => (
              <li
                key={documento.id}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-slate-800">
                  {documento.tipoDocumento
                    ? (TIPO_LABEL[documento.tipoDocumento as keyof typeof TIPO_LABEL] ??
                      documento.tipoDocumento)
                    : "Documento"}
                </span>
                <span className="text-slate-600">
                  {formatarData(documento.dataVencimento)} · {SITUACAO_LABEL[documento.situacao]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nenhum documento cadastrado para este veículo.</p>
        )}
        {tiposSemRegistro.length > 0 && (
          <p className="text-xs text-slate-500">
            Sem registro:{" "}
            {tiposSemRegistro
              .map((tipo) => TIPO_LABEL[tipo as keyof typeof TIPO_LABEL] ?? tipo)
              .join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Alertas de vencimento</h3>
        {alertas.length > 0 ? (
          <ListaAlertasDocumentos documentos={alertas} />
        ) : (
          <p className="text-sm text-slate-500">Nenhum documento com vencimento próximo.</p>
        )}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="text-base font-semibold text-slate-900">Cadastrar ou renovar</h3>
        <p className="text-xs text-slate-500">
          A renovação registra um novo vencimento do mesmo tipo; o histórico anterior é mantido.
        </p>
        <form onSubmit={salvarDocumento} className="space-y-3" noValidate>
          <fieldset disabled={isSaving} className="space-y-3">
            <Select
              label="Tipo de documento"
              value={tipoDocumento}
              onChange={(event) =>
                setTipoDocumento(event.target.value as (typeof TIPOS_DOCUMENTO_VEICULO)[number])
              }
              options={TIPOS_DOCUMENTO_VEICULO.map((tipo) => ({
                value: tipo,
                label: TIPO_LABEL[tipo],
              }))}
            />
            <Input
              label="Data de vencimento"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={dataVencimento}
              onChange={(event) => setDataVencimento(event.target.value)}
              required
            />
          </fieldset>
          {formError && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {formError}
            </p>
          )}
          {sucesso && (
            <p role="status" className="text-sm font-medium text-emerald-700">
              {sucesso}
            </p>
          )}
          <Button type="submit" variant="primary" isLoading={isSaving} className="w-full sm:w-auto">
            Salvar documento
          </Button>
        </form>
      </section>
    </div>
  );
}
