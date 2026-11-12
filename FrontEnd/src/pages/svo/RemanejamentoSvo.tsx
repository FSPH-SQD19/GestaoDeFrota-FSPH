import { useEffect, useState } from "react";
import { Button } from "../../components/common";
import {
  extrairErroSvo,
  obterRemanejamentosSvo,
  remanejarOrdemSvo,
  type OrdemColetaSvo,
  type ViaturaSvo,
  type MotoristaSvo,
  type RemanejamentoSvo,
} from "../../services/svo";

export function RemanejamentoSvo({
  ordem,
  viaturas,
  motoristas,
  onConcluido,
}: {
  ordem: OrdemColetaSvo;
  viaturas: ViaturaSvo[];
  motoristas: MotoristaSvo[];
  onConcluido: () => void;
}) {
  const [veiculoId, setVeiculo] = useState(ordem.veiculoId ?? "");
  const [motoristaId, setMotorista] = useState(ordem.motoristaId ?? "");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [historico, setHistorico] = useState<RemanejamentoSvo[]>([]);
  useEffect(() => {
    let ativo = true;
    obterRemanejamentosSvo(ordem.id)
      .then((data) => {
        if (ativo) setHistorico(data);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(extrairErroSvo(e));
      });
    return () => {
      ativo = false;
    };
  }, [ordem.id]);
  const salvar = async () => {
    setEnviando(true);
    setErro("");
    try {
      await remanejarOrdemSvo(ordem.id, { veiculoId, motoristaId, motivo });
      onConcluido();
    } catch (e: unknown) {
      setErro(extrairErroSvo(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Remanejamento de recursos</h3>
      {erro && (
        <p role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      )}
      {["EM_DESLOCAMENTO", "NO_LOCAL"].includes(ordem.status) && (
        <>
          <label className="block text-sm">
            Viatura de destino
            <select
              aria-label="Viatura de destino"
              className="mt-1 block w-full rounded border p-2"
              value={veiculoId}
              disabled={enviando}
              onChange={(e) => setVeiculo(e.target.value)}
            >
              {!viaturas.some((v) => v.id === ordem.veiculoId) && (
                <option value={ordem.veiculoId ?? ""}>{ordem.veiculo?.placa ?? "Selecione"}</option>
              )}
              {viaturas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.modelo} ({v.status}, {v.ocupacaoAtual}/{v.capacidadeMaxima})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Condutor de destino
            <select
              aria-label="Condutor de destino"
              className="mt-1 block w-full rounded border p-2"
              value={motoristaId}
              disabled={enviando}
              onChange={(e) => setMotorista(e.target.value)}
            >
              {!motoristas.some((m) => m.id === ordem.motoristaId) && (
                <option value={ordem.motoristaId ?? ""}>
                  {ordem.motorista?.usuario?.nome ?? "Selecione"}
                </option>
              )}
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.usuario?.nome ?? m.numeroCnh}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Motivo obrigatório
            <textarea
              aria-label="Motivo do remanejamento"
              className="mt-1 block w-full rounded border p-2"
              value={motivo}
              maxLength={500}
              disabled={enviando}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <Button
            disabled={
              enviando ||
              motivo.trim().length < 3 ||
              !veiculoId ||
              !motoristaId ||
              (veiculoId === ordem.veiculoId && motoristaId === ordem.motoristaId)
            }
            onClick={() => void salvar()}
          >
            Confirmar remanejamento
          </Button>
        </>
      )}
      <h4 className="text-sm font-semibold">Histórico de remanejamentos</h4>
      {historico.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma troca registrada.</p>
      )}
      {historico.map((h) => (
        <div key={h.id} className="border-t pt-2 text-sm">
          <p>
            {new Date(h.criadoEm).toLocaleString("pt-BR")} — {h.usuario?.nome ?? "Usuário removido"}
          </p>
          <p>
            {h.dadosNovos.anterior.placa} / {h.dadosNovos.anterior.condutor} →{" "}
            {h.dadosNovos.atual.placa} / {h.dadosNovos.atual.condutor}
          </p>
          <p>Motivo: {h.dadosNovos.motivo}</p>
        </div>
      ))}
    </section>
  );
}
