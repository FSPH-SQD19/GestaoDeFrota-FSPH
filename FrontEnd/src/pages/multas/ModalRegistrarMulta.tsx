import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Input, Modal, Select, Textarea } from "../../components/common";
import { criarMultaApi } from "../../services/multasService";
import type { GravidadeMulta, Multa, StatusMulta } from "../../types/multa";

interface OpcaoRecurso {
  value: string;
  label: string;
}

interface ModalRegistrarMultaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (multa: Multa) => void;
  veiculos: OpcaoRecurso[];
  motoristas: OpcaoRecurso[];
  veiculoIdPadrao?: string;
  motoristaIdPadrao?: string;
}

const GRAVIDADES: { value: GravidadeMulta; label: string; pontos: number }[] = [
  { value: "LEVE", label: "Leve (3 pontos)", pontos: 3 },
  { value: "MEDIA", label: "Média (4 pontos)", pontos: 4 },
  { value: "GRAVE", label: "Grave (5 pontos)", pontos: 5 },
  { value: "GRAVISSIMA", label: "Gravíssima (7 pontos)", pontos: 7 },
];

export const ModalRegistrarMulta: React.FC<ModalRegistrarMultaProps> = ({
  isOpen,
  onClose,
  onSuccess,
  veiculos,
  motoristas,
  veiculoIdPadrao,
  motoristaIdPadrao,
}) => {
  const [autoInfracao, setAutoInfracao] = useState("");
  const [veiculoId, setVeiculoId] = useState(veiculoIdPadrao || "");
  const [motoristaId, setMotoristaId] = useState(motoristaIdPadrao || "");
  const [dataHora, setDataHora] = useState(() => new Date().toISOString().slice(0, 16));
  const [gravidade, setGravidade] = useState<GravidadeMulta>("MEDIA");
  const [valor, setValor] = useState("");
  const [orgaoEmissor, setOrgaoEmissor] = useState("DETRAN-SE");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!autoInfracao.trim()) {
      setErro("Informe o número do auto de infração.");
      return;
    }
    if (!veiculoId) {
      setErro("Selecione o veículo envolvido na infração.");
      return;
    }
    const valorNumerico = Number(valor.replace(",", "."));
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setErro("Informe um valor válido em reais para a multa.");
      return;
    }

    try {
      setSalvando(true);
      const novaMulta = await criarMultaApi({
        autoInfracao: autoInfracao.trim(),
        veiculoId,
        motoristaId: motoristaId || null,
        dataHora: new Date(dataHora).toISOString(),
        gravidade,
        valor: valorNumerico,
        orgaoEmissor: orgaoEmissor.trim() || null,
        local: local.trim() || null,
        descricao: descricao.trim() || null,
        dataVencimento: dataVencimento || null,
        status: "PENDENTE" as StatusMulta,
        observacoes: observacoes.trim() || null,
      });

      onSuccess(novaMulta);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setErro(
        msg || "Não foi possível cadastrar a infração. Verifique os dados e tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Multa / Infração"
      description="Cadastre autos de infração de trânsito vinculados a veículos e condutores da FSPH."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-multa" isLoading={salvando}>
            Salvar Infração
          </Button>
        </>
      }
    >
      <form id="form-multa" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {erro && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 border border-rose-200/60"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Auto de infração"
            placeholder="Ex: SE-12345678"
            required
            value={autoInfracao}
            onChange={(e) => setAutoInfracao(e.target.value)}
          />

          <Select
            label="Órgão emissor"
            value={orgaoEmissor}
            onChange={(e) => setOrgaoEmissor(e.target.value)}
            options={[
              { value: "DETRAN-SE", label: "DETRAN-SE" },
              { value: "PRF", label: "Polícia Rodoviária Federal (PRF)" },
              { value: "SMTT Aracaju", label: "SMTT Aracaju" },
              { value: "DER-SE", label: "DER-SE" },
              { value: "OUTRO", label: "Outro" },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Veículo"
            required
            value={veiculoId}
            onChange={(e) => setVeiculoId(e.target.value)}
            placeholder="Selecione o veículo"
            options={veiculos}
          />

          <Select
            label="Condutor / Motorista (opcional)"
            value={motoristaId}
            onChange={(e) => setMotoristaId(e.target.value)}
            placeholder="Selecione o condutor (se identificado)"
            options={motoristas}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Data e hora"
            type="datetime-local"
            required
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
          />

          <Select
            label="Gravidade"
            required
            value={gravidade}
            onChange={(e) => setGravidade(e.target.value as GravidadeMulta)}
            options={GRAVIDADES.map((g) => ({ value: g.value, label: g.label }))}
          />

          <Input
            label="Valor (R$)"
            placeholder="Ex: 195,23"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Local da infração"
            placeholder="Ex: Av. Beira Mar, Aracaju/SE"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />

          <Input
            label="Data de vencimento"
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
          />
        </div>

        <Input
          label="Descrição do enquadramento"
          placeholder="Ex: Transitar em velocidade superior à máxima permitida em até 20%"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <Textarea
          label="Observações / Motivo"
          placeholder="Anotações internas, justificativa operacional ou detalhes do auto"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
        />
      </form>
    </Modal>
  );
};
