import { useRef, useState } from "react";
import { Button, Input } from "../../components/common";
import { apiRequest } from "../../lib/api";
import { kmRevisaoFormularioSchema } from "./veiculoRules";
import { IndicadorRevisao } from "./IndicadorRevisao";

export function RevisaoVeiculo({
  veiculoId,
  odometroAtual,
  kmProximaRevisao,
  onAtualizado,
}: {
  veiculoId: string;
  odometroAtual: number;
  kmProximaRevisao: number | null;
  onAtualizado: (kmProximaRevisao: number | null) => void;
}) {
  const [limite, setLimite] = useState(kmProximaRevisao?.toString() ?? "");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const salvando = useRef(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando.current) return;
    setErro("");
    setMensagem("");
    const validacao = kmRevisaoFormularioSchema.safeParse(limite);
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? "Confira a quilometragem da revisão.");
      return;
    }
    salvando.current = true;
    setEnviando(true);
    try {
      await apiRequest(`/veiculos/${encodeURIComponent(veiculoId)}`, {
        method: "PATCH",
        data: { kmProximaRevisao: validacao.data },
      });
      onAtualizado(validacao.data);
      setMensagem("Quilometragem da próxima revisão atualizada.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a revisão.");
    } finally {
      setEnviando(false);
      salvando.current = false;
    }
  }

  return (
    <div className="space-y-5">
      <IndicadorRevisao odometroAtual={odometroAtual} kmProximaRevisao={kmProximaRevisao} />
      <form onSubmit={salvar} className="space-y-3 border-t border-slate-200 pt-4">
        <Input
          label="Próxima revisão (km)"
          type="number"
          min="0.01"
          max="99999999.99"
          step="0.01"
          disabled={enviando}
          value={limite}
          onChange={(event) => setLimite(event.target.value)}
          helperText="Informe a leitura prevista no odômetro. Deixe vazio para remover o limite."
        />
        {erro && (
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
        )}
        {mensagem && (
          <p role="status" className="text-sm text-emerald-800">
            {mensagem}
          </p>
        )}
        <Button type="submit" isLoading={enviando}>
          Salvar revisão
        </Button>
      </form>
    </div>
  );
}
